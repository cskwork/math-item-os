// 6-시그널 유사 문항 랭킹 서비스
// 스킬 매칭, 수식 구조, 선수학습 거리, 텍스트 의미, 난이도 근접성, 오개념 프로필
// 6개 시그널을 가중합산하여 유사 문항을 랭킹한다.
import { prisma } from "@math-item-os/db";
import {
  buildEmbeddingText,
  generateEmbedding,
  findSimilarByVector,
} from "./embedding.service";
import type { SimilarItemRow } from "./embedding.service";

// -------------------------------------------------
// 시그널 가중치 상수
// -------------------------------------------------

const SIGNAL_WEIGHTS = {
  skillMatch: 0.30,
  formulaStructure: 0.20,
  prerequisiteDistance: 0.15,
  textSemantic: 0.15,
  difficultyProximity: 0.10,
  misconceptionProfile: 0.10,
} as const;

/** 난이도 최대 차이 (1-5 스케일) */
const MAX_DIFFICULTY_DIFF = 4;

/** 벡터 검색 시 limit의 배수 (리랭킹용 후보 확보) */
const CANDIDATE_MULTIPLIER = 3;

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

export interface SimilaritySignals {
  readonly skillMatch: number;
  readonly formulaStructure: number;
  readonly prerequisiteDistance: number;
  readonly textSemantic: number;
  readonly difficultyProximity: number;
  readonly misconceptionProfile: number;
}

export interface SimilarItemResult {
  readonly itemId: string;
  readonly score: number;
  readonly signals: SimilaritySignals;
  readonly explanation: string;
}

/** 후보 문항 조회 시 필요한 관계 데이터 */
interface CandidateItem {
  readonly id: string;
  readonly bodySympy: string | null;
  readonly difficultyAuthor: number | null;
  readonly skills: ReadonlyArray<{ readonly skillId: string }>;
  readonly misconceptions: ReadonlyArray<{ readonly misconceptionId: string }>;
}

/** 소스 문항 데이터 */
interface SourceItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodySympy: string | null;
  readonly difficultyAuthor: number | null;
  readonly skills: ReadonlyArray<{
    readonly skillId: string;
    readonly skill: { readonly title: string };
  }>;
  readonly misconceptions: ReadonlyArray<{
    readonly misconceptionId: string;
    readonly misconception: { readonly title: string };
  }>;
}

/** 시그널 이름과 한국어 라벨 매핑 */
const SIGNAL_LABELS: Record<keyof SimilaritySignals, string> = {
  skillMatch: "성취기준 일치",
  formulaStructure: "수식 구조 유사",
  prerequisiteDistance: "선수학습 연결",
  textSemantic: "텍스트 의미 유사",
  difficultyProximity: "난이도 근접",
  misconceptionProfile: "오개념 프로필 일치",
} as const;

// -------------------------------------------------
// 1. 메인 진입점: 유사 문항 검색
// -------------------------------------------------

/**
 * 소스 문항에 대해 6개 시그널 기반으로 유사 문항을 랭킹하여 반환한다.
 * 1) 소스 문항 + 관계 데이터 조회
 * 2) 임베딩이 없으면 생성
 * 3) pgvector로 후보 검색 (limit * 3)
 * 4) 후보 문항의 관계 데이터 벌크 조회
 * 5) 6개 시그널 계산 + 가중합산
 * 6) 상위 limit개 반환
 */
export async function findSimilarItems(
  sourceItemId: string,
  orgId: string,
  limit: number,
): Promise<ReadonlyArray<SimilarItemResult>> {
  // 소스 문항 조회 (관계 데이터 포함)
  const sourceItem = await fetchSourceItem(sourceItemId, orgId);
  if (sourceItem == null) {
    return [];
  }

  // 소스 임베딩 확보 (없으면 생성)
  const embedding = await ensureEmbedding(sourceItem);
  if (embedding == null) {
    return [];
  }

  // 벡터 유사도로 후보 검색
  const candidateLimit = limit * CANDIDATE_MULTIPLIER;
  const vectorResults = await findSimilarByVector(
    embedding,
    orgId,
    candidateLimit,
    sourceItemId,
  );

  if (vectorResults.length === 0) {
    return [];
  }

  // 후보 문항 벌크 조회
  const candidateIds = vectorResults.map((r) => r.itemId);
  const candidates = await fetchCandidateItems(candidateIds);

  // 벡터 거리를 itemId로 매핑
  const distanceMap = buildDistanceMap(vectorResults);

  // 소스 데이터 추출
  const sourceSkillIds = sourceItem.skills.map((s) => s.skillId);
  const sourceMcIds = sourceItem.misconceptions.map((m) => m.misconceptionId);

  // 각 후보에 대해 시그널 계산 + 스코어 산출
  const scoredResults = await scoreAllCandidates(
    candidates,
    sourceSkillIds,
    sourceMcIds,
    sourceItem.bodySympy,
    sourceItem.difficultyAuthor,
    distanceMap,
    orgId,
    sourceItem.skills,
  );

  // 스코어 내림차순 정렬, 상위 limit개 반환
  const sorted = [...scoredResults].sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit);
}

// -------------------------------------------------
// 2. 스킬 매칭 (Jaccard 유사도)
// -------------------------------------------------

/**
 * 소스/후보 스킬 ID 집합의 Jaccard 유사도를 계산한다.
 * |교집합| / |합집합| (둘 다 빈 경우 0)
 */
export function computeSkillMatch(
  sourceSkillIds: ReadonlyArray<string>,
  candidateSkillIds: ReadonlyArray<string>,
): number {
  if (sourceSkillIds.length === 0 && candidateSkillIds.length === 0) {
    return 0;
  }

  const sourceSet = new Set(sourceSkillIds);
  const candidateSet = new Set(candidateSkillIds);

  let intersectionSize = 0;
  for (const id of sourceSet) {
    if (candidateSet.has(id)) {
      intersectionSize += 1;
    }
  }

  const unionSize = new Set([...sourceSkillIds, ...candidateSkillIds]).size;

  if (unionSize === 0) {
    return 0;
  }

  return intersectionSize / unionSize;
}

// -------------------------------------------------
// 3. 수식 구조 유사도 (SymPy 토큰 Jaccard)
// -------------------------------------------------

/**
 * SymPy AST 문자열을 토큰으로 분리하여 Jaccard 유사도를 계산한다.
 * 둘 다 null이면 0을 반환한다.
 */
export function computeFormulaStructure(
  sourceSympy: string | null,
  candidateSympy: string | null,
): number {
  if (sourceSympy == null && candidateSympy == null) {
    return 0;
  }

  if (sourceSympy == null || candidateSympy == null) {
    return 0;
  }

  const sourceTokens = tokenizeSympy(sourceSympy);
  const candidateTokens = tokenizeSympy(candidateSympy);

  if (sourceTokens.size === 0 && candidateTokens.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of sourceTokens) {
    if (candidateTokens.has(token)) {
      intersectionSize += 1;
    }
  }

  const unionSize = new Set([...sourceTokens, ...candidateTokens]).size;

  if (unionSize === 0) {
    return 0;
  }

  return intersectionSize / unionSize;
}

// -------------------------------------------------
// 4. 선수학습 거리 (DAG 1-hop 검사)
// -------------------------------------------------

/**
 * 소스/후보 스킬 쌍 사이에 직접적인 선수학습 관계(1-hop)가 있는지 확인한다.
 * 직접 연결이 있으면 1.0, 없으면 0.0을 반환한다.
 * MVP: 1-hop만 확인한다.
 */
export async function computePrerequisiteDistance(
  sourceSkillIds: ReadonlyArray<string>,
  candidateSkillIds: ReadonlyArray<string>,
  orgId: string,
): Promise<number> {
  if (sourceSkillIds.length === 0 || candidateSkillIds.length === 0) {
    return 0;
  }

  // 소스-후보 스킬 쌍 간 직접 엣지 존재 여부 확인
  const directEdge = await prisma.prerequisiteEdge.findFirst({
    where: {
      orgId,
      OR: [
        {
          fromSkillId: { in: [...sourceSkillIds] },
          toSkillId: { in: [...candidateSkillIds] },
        },
        {
          fromSkillId: { in: [...candidateSkillIds] },
          toSkillId: { in: [...sourceSkillIds] },
        },
      ],
    },
    select: { id: true },
  });

  return directEdge != null ? 1.0 : 0.0;
}

// -------------------------------------------------
// 5. 텍스트 의미 유사도 (벡터 거리 변환)
// -------------------------------------------------

/**
 * pgvector 코사인 거리를 유사도로 변환한다.
 * similarity = 1 - distance (0-1 범위)
 */
export function computeTextSemantic(vectorDistance: number): number {
  return Math.max(0, Math.min(1, 1 - vectorDistance));
}

// -------------------------------------------------
// 6. 난이도 근접성
// -------------------------------------------------

/**
 * 소스/후보 난이도 차이를 0-1 유사도로 변환한다.
 * 1 - |source - candidate| / 4 (1-5 스케일 기준 최대 차이 4)
 * 어느 한쪽이 null이면 0.5(중립) 반환.
 */
export function computeDifficultyProximity(
  sourceDifficulty: number | null,
  candidateDifficulty: number | null,
): number {
  if (sourceDifficulty == null || candidateDifficulty == null) {
    return 0.5;
  }

  const diff = Math.abs(sourceDifficulty - candidateDifficulty);
  return 1 - diff / MAX_DIFFICULTY_DIFF;
}

// -------------------------------------------------
// 7. 오개념 프로필 (Jaccard 유사도)
// -------------------------------------------------

/**
 * 소스/후보 오개념 ID 집합의 Jaccard 유사도를 계산한다.
 * 둘 다 빈 경우 0을 반환한다.
 */
export function computeMisconceptionProfile(
  sourceMcIds: ReadonlyArray<string>,
  candidateMcIds: ReadonlyArray<string>,
): number {
  if (sourceMcIds.length === 0 && candidateMcIds.length === 0) {
    return 0;
  }

  const sourceSet = new Set(sourceMcIds);
  const candidateSet = new Set(candidateMcIds);

  let intersectionSize = 0;
  for (const id of sourceSet) {
    if (candidateSet.has(id)) {
      intersectionSize += 1;
    }
  }

  const unionSize = new Set([...sourceMcIds, ...candidateMcIds]).size;

  if (unionSize === 0) {
    return 0;
  }

  return intersectionSize / unionSize;
}

// -------------------------------------------------
// 8. 설명 생성 (한국어)
// -------------------------------------------------

/**
 * 시그널 값을 기반으로 한국어 설명 문자열을 생성한다.
 * 기여도가 높은 상위 3개 시그널을 설명에 포함한다.
 */
export function buildExplanation(
  signals: SimilaritySignals,
  sourceSkills: ReadonlyArray<{ readonly skill: { readonly title: string } }>,
  candidateSkillIds: ReadonlyArray<string>,
): string {
  // 각 시그널의 가중 기여도를 계산하여 내림차순 정렬
  const weightedSignals = Object.entries(signals)
    .map(([key, value]) => ({
      key: key as keyof SimilaritySignals,
      value: value as number,
      weighted: (value as number) * SIGNAL_WEIGHTS[key as keyof typeof SIGNAL_WEIGHTS],
    }))
    .sort((a, b) => b.weighted - a.weighted);

  // 기여도 상위 3개 시그널 설명 조각 생성
  const topSignals = weightedSignals
    .slice(0, 3)
    .filter((s) => s.value > 0);

  if (topSignals.length === 0) {
    return "유사도 시그널이 감지되지 않았습니다";
  }

  const parts = topSignals.map((s) => {
    const label = SIGNAL_LABELS[s.key];

    // 스킬 매칭인 경우 공통 스킬명 추가
    if (s.key === "skillMatch" && s.value > 0) {
      const commonSkillTitles = findCommonSkillTitles(
        sourceSkills,
        candidateSkillIds,
      );
      if (commonSkillTitles.length > 0) {
        return `${label}(${commonSkillTitles.join(", ")})`;
      }
    }

    return label;
  });

  return parts.join(", ");
}

// -------------------------------------------------
// 내부 헬퍼 함수
// -------------------------------------------------

/** 소스 문항을 관계 데이터와 함께 조회한다 */
async function fetchSourceItem(
  itemId: string,
  orgId: string,
): Promise<SourceItem | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      orgId: true,
      bodyLatex: true,
      bodySympy: true,
      difficultyAuthor: true,
      skills: {
        select: {
          skillId: true,
          skill: { select: { title: true } },
        },
      },
      misconceptions: {
        select: {
          misconceptionId: true,
          misconception: { select: { title: true } },
        },
      },
    },
  });

  if (item == null || item.orgId !== orgId) {
    return null;
  }

  return item;
}

/** 소스 문항의 임베딩을 확보한다. DB에 없으면 생성한다. */
async function ensureEmbedding(sourceItem: SourceItem): Promise<number[] | null> {
  // raw SQL로 임베딩 존재 여부 확인
  const rows = await prisma.$queryRawUnsafe<ReadonlyArray<{ has_embedding: boolean }>>(
    `SELECT embedding IS NOT NULL AS has_embedding FROM items WHERE id = $1`,
    sourceItem.id,
  );

  if (rows.length > 0 && rows[0]?.has_embedding) {
    // 임베딩이 이미 존재하면 벡터 값을 조회
    const vectorRows = await prisma.$queryRawUnsafe<
      ReadonlyArray<{ embedding: string }>
    >(
      `SELECT embedding::text FROM items WHERE id = $1 AND embedding IS NOT NULL`,
      sourceItem.id,
    );

    if (vectorRows.length > 0 && vectorRows[0]?.embedding) {
      return parseVectorString(vectorRows[0].embedding);
    }
  }

  // 임베딩이 없으면 생성
  const text = buildEmbeddingText({
    bodyLatex: sourceItem.bodyLatex,
    skills: sourceItem.skills.map((s) => ({ skill: s.skill })),
    misconceptions: sourceItem.misconceptions.map((m) => ({
      misconception: m.misconception,
    })),
  });

  const embedding = await generateEmbedding(text);

  if (embedding == null) {
    return null;
  }

  // DB에 저장 (fire-and-forget 아님, 즉시 사용해야 하므로 await)
  const vectorStr = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE items SET embedding = $1::vector WHERE id = $2`,
    vectorStr,
    sourceItem.id,
  );

  return embedding;
}

/** 벡터 문자열 "[0.1,0.2,...]" 을 number[]로 파싱한다 */
function parseVectorString(vectorStr: string): number[] {
  const cleaned = vectorStr.replace(/^\[/, "").replace(/\]$/, "");
  if (cleaned.length === 0) {
    return [];
  }
  return cleaned.split(",").map(Number);
}

/** 후보 문항을 관계 데이터와 함께 벌크 조회한다 */
async function fetchCandidateItems(
  itemIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<CandidateItem>> {
  if (itemIds.length === 0) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { id: { in: [...itemIds] } },
    select: {
      id: true,
      bodySympy: true,
      difficultyAuthor: true,
      skills: { select: { skillId: true } },
      misconceptions: { select: { misconceptionId: true } },
    },
  });

  return items;
}

/** 벡터 검색 결과를 itemId -> distance 맵으로 변환한다 */
function buildDistanceMap(
  vectorResults: ReadonlyArray<SimilarItemRow>,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const row of vectorResults) {
    map.set(row.itemId, row.distance);
  }
  return map;
}

/** SymPy 문자열을 토큰 집합으로 분리한다 */
function tokenizeSympy(sympyStr: string): ReadonlySet<string> {
  // 괄호, 연산자, 쉼표, 공백으로 분리하여 의미 있는 토큰만 추출
  const tokens = sympyStr
    .split(/[\s(),+\-*/^=<>[\]{}]+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/** 소스 스킬 중 후보가 공유하는 스킬의 제목을 반환한다 */
function findCommonSkillTitles(
  sourceSkills: ReadonlyArray<{
    readonly skillId?: string;
    readonly skill: { readonly title: string };
  }>,
  candidateSkillIds: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const candidateSet = new Set(candidateSkillIds);
  return sourceSkills
    .filter((s) => s.skillId != null && candidateSet.has(s.skillId))
    .map((s) => s.skill.title);
}

/**
 * 모든 후보에 대해 6개 시그널을 계산하고 가중합산 스코어를 산출한다.
 * prerequisiteDistance만 비동기이므로 Promise.all로 병렬 처리한다.
 */
async function scoreAllCandidates(
  candidates: ReadonlyArray<CandidateItem>,
  sourceSkillIds: ReadonlyArray<string>,
  sourceMcIds: ReadonlyArray<string>,
  sourceSympy: string | null,
  sourceDifficulty: number | null,
  distanceMap: ReadonlyMap<string, number>,
  orgId: string,
  sourceSkills: ReadonlyArray<{
    readonly skillId: string;
    readonly skill: { readonly title: string };
  }>,
): Promise<ReadonlyArray<SimilarItemResult>> {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const candidateSkillIds = candidate.skills.map((s) => s.skillId);
      const candidateMcIds = candidate.misconceptions.map((m) => m.misconceptionId);
      const vectorDistance = distanceMap.get(candidate.id) ?? 1.0;

      // 6개 시그널 계산 (prerequisiteDistance만 비동기)
      const [prerequisiteDistance] = await Promise.all([
        computePrerequisiteDistance(sourceSkillIds, candidateSkillIds, orgId),
      ]);

      const signals: SimilaritySignals = {
        skillMatch: computeSkillMatch(sourceSkillIds, candidateSkillIds),
        formulaStructure: computeFormulaStructure(sourceSympy, candidate.bodySympy),
        prerequisiteDistance,
        textSemantic: computeTextSemantic(vectorDistance),
        difficultyProximity: computeDifficultyProximity(
          sourceDifficulty,
          candidate.difficultyAuthor,
        ),
        misconceptionProfile: computeMisconceptionProfile(sourceMcIds, candidateMcIds),
      };

      const score = computeWeightedScore(signals);

      const explanation = buildExplanation(
        signals,
        sourceSkills,
        candidateSkillIds,
      );

      return {
        itemId: candidate.id,
        score,
        signals,
        explanation,
      };
    }),
  );

  return results;
}

/** 시그널 값에 가중치를 곱하여 합산한다 (0-1 범위) */
function computeWeightedScore(signals: SimilaritySignals): number {
  return (
    signals.skillMatch * SIGNAL_WEIGHTS.skillMatch +
    signals.formulaStructure * SIGNAL_WEIGHTS.formulaStructure +
    signals.prerequisiteDistance * SIGNAL_WEIGHTS.prerequisiteDistance +
    signals.textSemantic * SIGNAL_WEIGHTS.textSemantic +
    signals.difficultyProximity * SIGNAL_WEIGHTS.difficultyProximity +
    signals.misconceptionProfile * SIGNAL_WEIGHTS.misconceptionProfile
  );
}
