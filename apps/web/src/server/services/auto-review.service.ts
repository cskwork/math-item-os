// AI 자동 리뷰 + 난이도 추정 서비스
// 문항 생성 시 fire-and-forget으로 실행되어 검토 제안을 생성한다.
import { prisma } from "@math-item-os/db";
import type { SchoolLevel, ItemType, Prisma } from "@math-item-os/db";
import katex from "katex";
import { generateEmbedding, findSimilarByVector } from "./embedding.service";

// -------------------------------------------------
// 환경 변수
// -------------------------------------------------

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

const CAS_TIMEOUT_MS = 10_000;

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

export interface AutoReviewResult {
  overallScore: number;
  checks: {
    latexValid: { passed: boolean; message: string };
    metadataComplete: { passed: boolean; score: number; missing: string[] };
    duplicateDetected: {
      passed: boolean;
      similarItemIds: string[];
      bestDistance: number | null;
    };
    casSolvable: { passed: boolean; message: string };
  };
  suggestedAction: "approve" | "review" | "flag";
}

export interface DifficultyEstimate {
  estimated: number;
  confidence: number;
  factors: string[];
}

// -------------------------------------------------
// 1. LaTeX 유효성 검사
// -------------------------------------------------

function checkLatexValid(bodyLatex: string): {
  passed: boolean;
  message: string;
} {
  try {
    katex.renderToString(bodyLatex, { throwOnError: true, displayMode: true });
    return { passed: true, message: "LaTeX 구문이 유효합니다" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 파싱 오류";
    return { passed: false, message: `LaTeX 파싱 실패: ${msg}` };
  }
}

// -------------------------------------------------
// 2. 메타데이터 완전성 검사
// -------------------------------------------------

interface MetadataCheckInput {
  bodyLatex: string;
  schoolLevel: string;
  grade: number;
  itemType: string;
  answerFormat: string;
  answerValue: string | null;
  semester: string | null;
  solutionSteps: number | null;
  usagePurposes: string[];
  difficultyAuthor: number | null;
  skillCount: number;
  standardCount: number;
}

function checkMetadataComplete(input: MetadataCheckInput): {
  passed: boolean;
  score: number;
  missing: string[];
} {
  // 필수 필드 확인
  const requiredPresent =
    input.bodyLatex.length > 0 &&
    input.schoolLevel.length > 0 &&
    input.grade > 0 &&
    input.itemType.length > 0 &&
    input.answerFormat.length > 0 &&
    input.answerValue != null &&
    input.answerValue.length > 0;

  if (!requiredPresent) {
    const missing: string[] = [];
    if (!input.bodyLatex) missing.push("bodyLatex");
    if (!input.schoolLevel) missing.push("schoolLevel");
    if (!input.grade) missing.push("grade");
    if (!input.itemType) missing.push("itemType");
    if (!input.answerFormat) missing.push("answerFormat");
    if (!input.answerValue) missing.push("answer.value");
    return { passed: false, score: 0, missing };
  }

  // 선택 필드 점수 (0-1)
  const optionalFields = [
    { name: "semester", filled: input.semester != null },
    { name: "solutionSteps", filled: input.solutionSteps != null },
    { name: "usagePurposes", filled: input.usagePurposes.length > 0 },
    { name: "difficultyAuthor", filled: input.difficultyAuthor != null },
    { name: "skillIds", filled: input.skillCount > 0 },
    { name: "standardIds", filled: input.standardCount > 0 },
  ];

  const filledCount = optionalFields.filter((f) => f.filled).length;
  const score = filledCount / optionalFields.length;
  const missing = optionalFields
    .filter((f) => !f.filled)
    .map((f) => f.name);

  return { passed: true, score, missing };
}

// -------------------------------------------------
// 3. 중복 감지
// -------------------------------------------------

async function checkDuplicate(
  bodyLatex: string,
  orgId: string,
  excludeItemId: string,
): Promise<{
  passed: boolean;
  similarItemIds: string[];
  bestDistance: number | null;
}> {
  const embedding = await generateEmbedding(bodyLatex);
  if (embedding == null) {
    return { passed: true, similarItemIds: [], bestDistance: null };
  }

  const similar = await findSimilarByVector(embedding, orgId, 5, excludeItemId);
  const duplicates = similar.filter((s) => s.distance < 0.1);

  if (duplicates.length > 0) {
    return {
      passed: false,
      similarItemIds: duplicates.map((d) => d.itemId),
      bestDistance: duplicates[0]!.distance,
    };
  }

  return {
    passed: true,
    similarItemIds: [],
    bestDistance: similar.length > 0 ? similar[0]!.distance : null,
  };
}

// -------------------------------------------------
// 4. CAS 풀이 검증
// -------------------------------------------------

async function checkCasSolvable(
  bodyLatex: string,
  answerValue: string,
): Promise<{ passed: boolean; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CAS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${MATH_AI_SERVICE_URL}/validate/solve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latex: bodyLatex,
          expected_answer: answerValue,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return { passed: false, message: "CAS 서비스 응답 오류" };
    }

    const data = (await response.json()) as {
      solvable: boolean;
      solution?: string;
    };
    return {
      passed: data.solvable,
      message: data.solvable
        ? `CAS 풀이 검증 성공${data.solution ? `: ${data.solution}` : ""}`
        : "CAS에서 정답을 검증할 수 없습니다",
    };
  } catch {
    return { passed: false, message: "CAS 서비스에 연결할 수 없습니다" };
  } finally {
    clearTimeout(timeoutId);
  }
}

// -------------------------------------------------
// 5. 자동 리뷰 실행
// -------------------------------------------------

type ItemForReview = {
  id: string;
  bodyLatex: string;
  schoolLevel: string;
  grade: number;
  itemType: string;
  answerFormat: string;
  answer: Prisma.JsonValue;
  semester: string | null;
  solutionSteps: number | null;
  usagePurposes: string[];
  difficultyAuthor: number | null;
  skills: { id: string }[];
  standards: { id: string }[];
};

export async function performAutoReview(
  item: ItemForReview,
  orgId: string,
): Promise<AutoReviewResult> {
  const itemId = item.id;

  const answerValue =
    typeof item.answer === "object" && item.answer !== null
      ? (item.answer as { value?: string }).value ?? null
      : null;

  // 4개 검사를 병렬 실행
  const [latexValid, metadataComplete, duplicateDetected, casSolvable] =
    await Promise.all([
      Promise.resolve(checkLatexValid(item.bodyLatex)),
      Promise.resolve(
        checkMetadataComplete({
          bodyLatex: item.bodyLatex,
          schoolLevel: item.schoolLevel,
          grade: item.grade,
          itemType: item.itemType,
          answerFormat: item.answerFormat,
          answerValue,
          semester: item.semester,
          solutionSteps: item.solutionSteps,
          usagePurposes: item.usagePurposes,
          difficultyAuthor: item.difficultyAuthor,
          skillCount: item.skills.length,
          standardCount: item.standards.length,
        }),
      ),
      checkDuplicate(item.bodyLatex, orgId, itemId),
      answerValue
        ? checkCasSolvable(item.bodyLatex, answerValue)
        : Promise.resolve({
            passed: false,
            message: "정답 값이 없어 CAS 검증을 건너뜁니다",
          }),
    ]);

  // 가중 평균 산출
  const latexScore = latexValid.passed ? 1 : 0;
  const metaScore = metadataComplete.passed ? metadataComplete.score : 0;
  const dupScore = duplicateDetected.passed ? 1 : 0;
  const casScore = casSolvable.passed ? 1 : 0;

  const overallScore =
    latexScore * 0.3 +
    metaScore * 0.2 +
    dupScore * 0.25 +
    casScore * 0.25;

  let suggestedAction: "approve" | "review" | "flag";
  if (overallScore >= 0.8) {
    suggestedAction = "approve";
  } else if (overallScore >= 0.5) {
    suggestedAction = "review";
  } else {
    suggestedAction = "flag";
  }

  return {
    overallScore,
    checks: { latexValid, metadataComplete, duplicateDetected, casSolvable },
    suggestedAction,
  };
}

// -------------------------------------------------
// 6. 난이도 추정 (휴리스틱)
// -------------------------------------------------

export function estimateDifficulty(
  bodyLatex: string,
  itemType: ItemType,
  solutionSteps: number | null,
  schoolLevel: SchoolLevel,
  grade: number,
): DifficultyEstimate {
  const factors: string[] = [];

  // 학교급 기반 난이도
  const baseDifficultyMap: Record<SchoolLevel, number> = {
    elementary: 1,
    middle: 2,
    high: 3,
  };
  let difficulty = baseDifficultyMap[schoolLevel];
  factors.push(`학교급: ${schoolLevel} (기본 ${difficulty})`);

  // 학년 보정: 해당 학교급 내 첫 학년 이후 +0.3/학년
  const gradeWithinLevel = getGradeWithinLevel(schoolLevel, grade);
  if (gradeWithinLevel > 0) {
    const gradeAdjust = gradeWithinLevel * 0.3;
    difficulty += gradeAdjust;
    factors.push(`학년 보정: +${gradeAdjust.toFixed(1)}`);
  }

  // 풀이 단계 보정: 1단계 초과 시 +0.2/단계
  if (solutionSteps != null && solutionSteps > 1) {
    const stepsAdjust = (solutionSteps - 1) * 0.2;
    difficulty += stepsAdjust;
    factors.push(`풀이 단계(${solutionSteps}): +${stepsAdjust.toFixed(1)}`);
  }

  // 문항 유형 보정
  const typeAdjustMap: Partial<Record<ItemType, number>> = {
    essay: 0.5,
    fill_in_blank: 0.3,
    short_answer: 0.2,
  };
  const typeAdjust = typeAdjustMap[itemType];
  if (typeAdjust != null) {
    difficulty += typeAdjust;
    factors.push(`유형(${itemType}): +${typeAdjust.toFixed(1)}`);
  }

  // 1-5 범위로 클램프 후 반올림
  const estimated = Math.round(Math.max(1, Math.min(5, difficulty)));

  // 신뢰도: 입력 정보가 많을수록 높음
  let confidence = 0.5;
  if (solutionSteps != null) confidence += 0.2;
  if (bodyLatex.length > 50) confidence += 0.1;
  if (bodyLatex.length > 200) confidence += 0.1;
  confidence = Math.min(1, confidence);

  return { estimated, confidence, factors };
}

/** 학교급 내에서의 학년 오프셋 (0-based) */
function getGradeWithinLevel(
  schoolLevel: SchoolLevel,
  grade: number,
): number {
  // 학교급별 시작 학년
  const startGrade: Record<SchoolLevel, number> = {
    elementary: 1,
    middle: 1,
    high: 1,
  };
  return Math.max(0, grade - startGrade[schoolLevel]);
}

// -------------------------------------------------
// 7. fire-and-forget 진입점
// -------------------------------------------------

/**
 * 문항 생성 후 호출. 자동 리뷰 + 난이도 추정 결과를 DB에 저장한다.
 * fire-and-forget: 오류가 발생해도 호출자에 전파하지 않는다.
 */
export async function runAutoReview(
  itemId: string,
  orgId: string,
): Promise<void> {
  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        skills: true,
        standards: true,
        difficultyProfile: { select: { behavioralDifficulty: true } },
      },
    });

    if (!item) return;

    // 자동 리뷰 + 난이도 추정 병렬 실행
    const [reviewResult, difficultyResult] = await Promise.all([
      performAutoReview(item, orgId),
      Promise.resolve(
        estimateDifficulty(
          item.bodyLatex,
          item.itemType,
          item.solutionSteps,
          item.schoolLevel,
          item.grade,
        ),
      ),
    ]);

    // DB에 저장
    await prisma.reviewSuggestion.createMany({
      data: [
        {
          itemId,
          checkType: "auto_review",
          result: reviewResult as unknown as Prisma.InputJsonValue,
          overallScore: reviewResult.overallScore,
          suggestedAction: reviewResult.suggestedAction,
        },
        {
          itemId,
          checkType: "difficulty_estimate",
          result: difficultyResult as unknown as Prisma.InputJsonValue,
          overallScore: null,
          suggestedAction: null,
        },
      ],
    });

    // 난이도 프로필에 behavioralDifficulty가 없으면 추정값으로 업데이트
    if (item.difficultyProfile && item.difficultyProfile.behavioralDifficulty == null) {
      // 추정 난이도를 0-1 스케일로 변환 (1-5 -> 0-1)
      const behavioral = (difficultyResult.estimated - 1) / 4;
      await prisma.difficultyProfile.update({
        where: { itemId },
        data: { behavioralDifficulty: behavioral },
      });
    }
  } catch (error) {
    console.error('Auto-review failed for item', itemId, error);
  }
}

// -------------------------------------------------
// 8. 검토 제안 조회
// -------------------------------------------------

export async function getReviewSuggestions(itemId: string, orgId: string) {
  // 문항 소속 확인
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { orgId: true },
  });

  if (!item || item.orgId !== orgId) {
    return [];
  }

  return prisma.reviewSuggestion.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
  });
}
