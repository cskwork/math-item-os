// 학습지 문항 추천 엔진 - 목적/난이도/스킬 조합 기반 추천 + 근거 제공
// Constitution II: 설명 가능한 추천, Constitution IV: 승인 문항만 사용
import { prisma } from "@math-item-os/db";
import type { Prisma, UsagePurpose } from "@math-item-os/db";
import { createRecommendationEvent } from "./recommendation.service";

// -------------------------------------------------
// 상수 정의
// -------------------------------------------------

const DEFAULT_COUNT = 10;
const DEFAULT_DIFFICULTY = 3;

/** 추천 점수 가중치 */
const SCORING_WEIGHTS = {
  skillRelevance: 0.40,
  difficultyFit: 0.30,
  purposeMatch: 0.20,
  diversity: 0.10,
} as const;

// -------------------------------------------------
// 입력/출력 타입 정의
// -------------------------------------------------

export interface RecommendItemsInput {
  readonly purpose: UsagePurpose;
  readonly skillIds?: readonly string[];
  readonly difficulty?: number;
  readonly count: number;
  readonly excludeItemIds?: readonly string[];
}

export interface RecommendedItem {
  readonly item: CandidateItem;
  readonly score: number;
  readonly reason: string;
}

export interface RecommendationReasoning {
  readonly purpose: string;
  readonly strategy: string;
  readonly difficultyRange: readonly [number, number];
  readonly skillCoverage: number;
  readonly totalCandidates: number;
}

export interface RecommendationResult {
  readonly items: readonly RecommendedItem[];
  readonly reasoning: RecommendationReasoning;
}

/** 후보 문항 조회 시 포함할 관계 데이터 */
const CANDIDATE_INCLUDE = {
  skills: { include: { skill: true } },
  misconceptions: { include: { misconception: true } },
} satisfies Prisma.ItemInclude;

/** 관계 데이터를 포함한 후보 문항 타입 */
type CandidateItem = Prisma.ItemGetPayload<{
  include: typeof CANDIDATE_INCLUDE;
}>;

/** 개별 문항 채점 결과 */
interface ScoredCandidate {
  readonly item: CandidateItem;
  readonly score: number;
  readonly reason: string;
}

// -------------------------------------------------
// 목적별 전략 설명
// -------------------------------------------------

const PURPOSE_STRATEGY: Record<UsagePurpose, string> = {
  diagnosis: "다양한 난이도(1-5)를 고르게 분포하여 여러 스킬을 진단합니다",
  remediation: "낮은 난이도(1-3)의 선수 스킬 중심 연습 문항을 우선 추천합니다",
  pre_exam: "목표 난이도 근처에서 스킬 균형을 맞춘 시험 대비 문항을 추천합니다",
  advanced: "높은 난이도(4-5)의 심화 스킬 문항을 추천합니다",
  practice: "목표 난이도 근처의 일반 연습 문항을 추천합니다",
  review: "복습용으로 다양한 난이도의 문항을 추천합니다",
};

// -------------------------------------------------
// 1. 메인 추천 함수
// -------------------------------------------------

/**
 * 목적/난이도/스킬 조합에 기반하여 학습지 문항을 추천한다.
 * - 승인 문항만 대상 (Constitution IV)
 * - 추천 근거를 함께 제공 (Constitution II)
 */
export async function recommendItems(
  input: RecommendItemsInput,
  orgId: string,
): Promise<RecommendationResult> {
  const count = input.count > 0 ? input.count : DEFAULT_COUNT;
  const targetDifficulty = input.difficulty ?? DEFAULT_DIFFICULTY;
  const [diffMin, diffMax] = getDifficultyRange(input.purpose, targetDifficulty);

  // (a) 승인 문항 후보 조회
  const candidates = await fetchCandidateItems(
    orgId,
    diffMin,
    diffMax,
    input.skillIds ?? [],
    input.excludeItemIds ?? [],
  );

  // 요청 스킬 Set (채점용)
  const requestedSkillSet = new Set(input.skillIds ?? []);

  // (e) Greedy 선택: 상위 점수 문항부터 선택하며 다양성 재점수
  const selectedItems = greedySelect(
    candidates,
    input,
    requestedSkillSet,
    targetDifficulty,
    count,
  );

  // (f) 스킬 커버리지 계산
  const skillCoverage = computeSkillCoverage(selectedItems, requestedSkillSet);

  // 추천 근거 구성 (Constitution II)
  const reasoning: RecommendationReasoning = {
    purpose: input.purpose,
    strategy: PURPOSE_STRATEGY[input.purpose],
    difficultyRange: [diffMin, diffMax],
    skillCoverage,
    totalCandidates: candidates.length,
  };

  // 추천 이벤트 로깅
  if (selectedItems.length > 0) {
    const recType = mapPurposeToRecType(input.purpose);
    await createRecommendationEvent(
      {
        recType,
        itemIds: selectedItems.map((si) => si.item.id),
        reasoning: reasoning as unknown as Record<string, unknown>,
      },
      orgId,
    );
  }

  return {
    items: selectedItems,
    reasoning,
  };
}

// -------------------------------------------------
// 2. 목적별 난이도 범위 결정
// -------------------------------------------------

/** 목적과 목표 난이도에 따른 필터 범위를 반환한다 */
export function getDifficultyRange(
  purpose: UsagePurpose,
  targetDifficulty?: number,
): readonly [number, number] {
  const td = targetDifficulty ?? DEFAULT_DIFFICULTY;

  switch (purpose) {
    case "diagnosis":
      return [1, 5];
    case "remediation":
      return [1, Math.min(td, 3)];
    case "pre_exam":
      return [Math.max(1, td - 1), Math.min(5, td + 1)];
    case "advanced":
      return [Math.max(4, td), 5];
    case "practice":
      return [Math.max(1, td - 1), Math.min(5, td + 1)];
    case "review":
      return [1, 5];
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}

// -------------------------------------------------
// 3. 개별 후보 채점
// -------------------------------------------------

/** 단일 후보 문항의 추천 점수와 근거를 계산한다 */
export function scoreCandidateItem(
  item: CandidateItem,
  input: RecommendItemsInput,
  alreadySelected: readonly CandidateItem[],
): ScoredCandidate {
  const requestedSkillSet = new Set(input.skillIds ?? []);
  const targetDifficulty = input.difficulty ?? DEFAULT_DIFFICULTY;

  const skillRelevance = computeSkillRelevance(item, requestedSkillSet);
  const difficultyFit = computeDifficultyFit(item, targetDifficulty);
  const purposeMatch = computePurposeMatch(item, input.purpose);
  const diversity = computeDiversity(item, alreadySelected);

  const score =
    SCORING_WEIGHTS.skillRelevance * skillRelevance +
    SCORING_WEIGHTS.difficultyFit * difficultyFit +
    SCORING_WEIGHTS.purposeMatch * purposeMatch +
    SCORING_WEIGHTS.diversity * diversity;

  const reason = buildItemReason(
    skillRelevance,
    difficultyFit,
    purposeMatch,
    diversity,
    item,
    input.purpose,
  );

  return { item, score, reason };
}

// -------------------------------------------------
// 내부 헬퍼: 후보 조회
// -------------------------------------------------

/** 승인 문항 중 난이도 범위에 해당하는 후보를 조회한다 */
async function fetchCandidateItems(
  orgId: string,
  diffMin: number,
  diffMax: number,
  skillIds: readonly string[],
  excludeItemIds: readonly string[],
): Promise<readonly CandidateItem[]> {
  const where: Prisma.ItemWhereInput = {
    orgId,
    status: "approved",
    difficultyAuthor: {
      not: null,
      gte: diffMin,
      lte: diffMax,
    },
    ...(excludeItemIds.length > 0 && {
      id: { notIn: [...excludeItemIds] },
    }),
    ...(skillIds.length > 0 && {
      skills: { some: { skillId: { in: [...skillIds] } } },
    }),
  };

  return prisma.item.findMany({
    where,
    include: CANDIDATE_INCLUDE,
    take: 200, // 후보 상한 (성능 보호)
    orderBy: { createdAt: "desc" },
  });
}

// -------------------------------------------------
// 내부 헬퍼: Greedy 선택
// -------------------------------------------------

/**
 * 상위 점수 문항부터 하나씩 선택하며, 선택 후 남은 후보의 다양성을 재계산한다.
 * 불변 패턴: 매 반복마다 새 배열 생성.
 */
function greedySelect(
  candidates: readonly CandidateItem[],
  input: RecommendItemsInput,
  requestedSkillSet: ReadonlySet<string>,
  targetDifficulty: number,
  count: number,
): readonly RecommendedItem[] {
  if (candidates.length === 0) {
    return [];
  }

  let selected: readonly RecommendedItem[] = [];
  let remaining = [...candidates];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // 현재 선택 목록 기준으로 후보 채점
    const alreadySelectedItems = selected.map((s) => s.item);
    const scored: readonly ScoredCandidate[] = remaining.map((candidate) =>
      scoreCandidateItem(candidate, input, alreadySelectedItems),
    );

    // 최고 점수 후보 선택
    const best = pickBestCandidate(scored);
    if (best == null) break;

    selected = [
      ...selected,
      {
        item: best.item,
        score: roundScore(best.score),
        reason: best.reason,
      },
    ];

    // 선택된 문항을 후보에서 제거
    remaining = remaining.filter((c) => c.id !== best.item.id);
  }

  return selected;
}

/** 채점 결과 중 최고 점수 후보를 반환한다 */
function pickBestCandidate(
  scored: readonly ScoredCandidate[],
): ScoredCandidate | undefined {
  if (scored.length === 0) return undefined;

  return scored.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
}

// -------------------------------------------------
// 내부 헬퍼: 채점 세부 계산
// -------------------------------------------------

/** 스킬 관련도 - 요청 스킬과 문항 스킬의 Jaccard 유사도 */
function computeSkillRelevance(
  item: CandidateItem,
  requestedSkillSet: ReadonlySet<string>,
): number {
  if (requestedSkillSet.size === 0) return 1.0; // 스킬 미지정 시 최고점

  const itemSkillIds = new Set(item.skills.map((sk) => sk.skillId));
  const intersection = [...requestedSkillSet].filter((id) => itemSkillIds.has(id));
  const union = new Set([...requestedSkillSet, ...itemSkillIds]);

  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/** 난이도 적합도 - 목표 난이도와의 거리 기반 (0-1) */
function computeDifficultyFit(
  item: CandidateItem,
  targetDifficulty: number,
): number {
  const itemDifficulty = item.difficultyAuthor;
  if (itemDifficulty == null) return 0;

  // 최대 거리 4 (1~5 범위), 거리 0이면 점수 1.0
  const distance = Math.abs(itemDifficulty - targetDifficulty);
  return Math.max(0, 1 - distance / 4);
}

/** 목적 적합도 - usagePurposes에 해당 목적이 포함되는지 확인 */
function computePurposeMatch(
  item: CandidateItem,
  purpose: UsagePurpose,
): number {
  const purposes = item.usagePurposes ?? [];
  if (purposes.length === 0) return 0.5; // 미분류 문항은 중간값
  return purposes.includes(purpose) ? 1.0 : 0.0;
}

/** 다양성 점수 - 이미 선택된 문항과의 스킬 중복을 패널티 */
function computeDiversity(
  item: CandidateItem,
  alreadySelected: readonly CandidateItem[],
): number {
  if (alreadySelected.length === 0) return 1.0;

  const itemSkillIds = new Set(item.skills.map((sk) => sk.skillId));
  if (itemSkillIds.size === 0) return 0.5;

  // 선택된 문항들의 스킬과 겹치는 비율이 낮을수록 높은 점수
  const selectedSkillIds = new Set(
    alreadySelected.flatMap((si) => si.skills.map((sk) => sk.skillId)),
  );

  const overlap = [...itemSkillIds].filter((id) => selectedSkillIds.has(id)).length;
  const overlapRatio = overlap / itemSkillIds.size;

  return Math.max(0, 1 - overlapRatio);
}

// -------------------------------------------------
// 내부 헬퍼: 스킬 커버리지 계산
// -------------------------------------------------

/** 선택된 문항들이 요청 스킬을 얼마나 커버하는지 계산 (0-1) */
function computeSkillCoverage(
  selectedItems: readonly RecommendedItem[],
  requestedSkillSet: ReadonlySet<string>,
): number {
  if (requestedSkillSet.size === 0) return 1.0;

  const coveredSkillIds = new Set(
    selectedItems.flatMap((si) => si.item.skills.map((sk) => sk.skillId)),
  );

  const covered = [...requestedSkillSet].filter((id) => coveredSkillIds.has(id)).length;
  return covered / requestedSkillSet.size;
}

// -------------------------------------------------
// 내부 헬퍼: 추천 근거 문구 생성
// -------------------------------------------------

/** 개별 문항의 추천 근거를 한국어로 생성한다 */
function buildItemReason(
  skillRelevance: number,
  difficultyFit: number,
  purposeMatch: number,
  diversity: number,
  item: CandidateItem,
  purpose: UsagePurpose,
): string {
  const parts: string[] = [];

  if (skillRelevance >= 0.7) {
    parts.push("요청 스킬과 높은 관련도");
  } else if (skillRelevance >= 0.3) {
    parts.push("요청 스킬과 부분 일치");
  }

  if (difficultyFit >= 0.75) {
    parts.push(`난이도 ${item.difficultyAuthor ?? "미정"}(목표 부합)`);
  } else {
    parts.push(`난이도 ${item.difficultyAuthor ?? "미정"}`);
  }

  if (purposeMatch >= 1.0) {
    parts.push(`${purpose} 용도로 분류됨`);
  }

  if (diversity >= 0.8) {
    parts.push("스킬 다양성 확보");
  }

  return parts.length > 0
    ? parts.join(", ")
    : "기본 조건 충족 문항";
}

// -------------------------------------------------
// 내부 헬퍼: 유틸리티
// -------------------------------------------------

/** 점수를 소수점 3자리로 반올림한다 */
function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

/** 학습지 목적을 RecType으로 매핑한다 */
function mapPurposeToRecType(
  purpose: UsagePurpose,
): "remediation" | "advancement" | "practice" | "review" {
  switch (purpose) {
    case "diagnosis":
      return "review";
    case "remediation":
      return "remediation";
    case "pre_exam":
      return "practice";
    case "advanced":
      return "advancement";
    case "practice":
      return "practice";
    case "review":
      return "review";
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}
