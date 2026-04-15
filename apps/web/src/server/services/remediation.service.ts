// 오개념 기반 교정 학습 경로 생성 서비스
// 3단계: 선수 개념 복습 -> 기본 연습 -> 확인 심화
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import { logRemediationRecommendation } from "./recommendation.service";

// -------------------------------------------------
// 상수 정의
// -------------------------------------------------

const DEFAULT_DIFFICULTY = 3;
const DEFAULT_LIMIT_PER_PHASE = 3;

/** 교정 경로 단계 */
type RemediationPhase =
  | "prerequisite_review"
  | "basic_practice"
  | "confirmation";

// -------------------------------------------------
// 입력/출력 타입 정의
// -------------------------------------------------

export interface GetRemediationPathParams {
  readonly misconceptionId: string;
  readonly difficulty?: number;
  readonly limit?: number;
}

/** 문항 조회 시 포함할 관계 데이터 */
const ITEM_INCLUDE = {
  skills: { include: { skill: true } },
  standards: { include: { standard: true } },
  misconceptions: { include: { misconception: true } },
} satisfies Prisma.ItemInclude;

/** 관계 데이터를 포함한 문항 타입 */
type ItemWithRelations = Prisma.ItemGetPayload<{
  include: typeof ITEM_INCLUDE;
}>;

export interface RemediationStep {
  readonly phase: RemediationPhase;
  readonly items: ReadonlyArray<ItemWithRelations>;
  readonly explanation: string;
}

export interface RemediationPath {
  readonly steps: ReadonlyArray<RemediationStep>;
}

// -------------------------------------------------
// 메인 함수: 교정 학습 경로 생성
// -------------------------------------------------

/**
 * 오개념에 기반한 3단계 교정 학습 경로를 생성한다.
 * 1) prerequisite_review: 관련 스킬의 선수 개념 복습 문항
 * 2) basic_practice: 해당 오개념 관련 기본 연습 문항
 * 3) confirmation: 이해 확인용 심화 문항
 */
export async function getRemediationPath(
  params: GetRemediationPathParams,
  orgId: string,
): Promise<RemediationPath> {
  const difficulty = params.difficulty ?? DEFAULT_DIFFICULTY;
  const limit = params.limit ?? DEFAULT_LIMIT_PER_PHASE;

  // 오개념 조회
  const misconception = await prisma.misconception.findUnique({
    where: { id: params.misconceptionId },
  });

  if (misconception == null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `오개념을 찾을 수 없습니다: ${params.misconceptionId}`,
    });
  }

  if (misconception.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 오개념이 아닙니다",
    });
  }

  const relatedSkillIds = misconception.relatedSkills;

  // 관련 스킬이 없으면 빈 경로 반환
  if (relatedSkillIds.length === 0) {
    return { steps: [] };
  }

  // relatedSkills에는 skill ID가 저장되어 있으므로 존재 여부만 검증
  const skillRows = await prisma.skill.findMany({
    where: { orgId, id: { in: [...relatedSkillIds] } },
    select: { id: true },
  });
  const validSkillIds = skillRows.map((s) => s.id);

  if (validSkillIds.length === 0) {
    return { steps: [] };
  }

  // 단계별 중복 방지를 위한 선택된 문항 ID 집합
  const selectedIds = new Set<string>();

  // Phase 1: 선수 개념 복습
  const prerequisiteItems = await fetchPrerequisiteReviewItems(
    validSkillIds,
    orgId,
    difficulty,
    limit,
    selectedIds,
  );
  addToSelectedIds(selectedIds, prerequisiteItems);

  // Phase 2: 기본 연습
  const basicItems = await fetchBasicPracticeItems(
    validSkillIds,
    orgId,
    difficulty,
    limit,
    selectedIds,
  );
  addToSelectedIds(selectedIds, basicItems);

  // Phase 3: 확인 심화
  const confirmationItems = await fetchConfirmationItems(
    validSkillIds,
    orgId,
    difficulty,
    limit,
    selectedIds,
  );

  const steps: ReadonlyArray<RemediationStep> = [
    {
      phase: "prerequisite_review",
      items: prerequisiteItems,
      explanation: "관련 성취기준의 선수 개념을 복습합니다",
    },
    {
      phase: "basic_practice",
      items: basicItems,
      explanation: `${misconception.title}과 관련된 기본 문제를 연습합니다`,
    },
    {
      phase: "confirmation",
      items: confirmationItems,
      explanation: "이해를 확인하는 심화 문제입니다",
    },
  ];

  // 추천 이벤트 로깅 (Constitution II: 설명 가능한 추천)
  const hasItems = steps.some((s) => s.items.length > 0);
  if (hasItems) {
    await logRemediationRecommendation(
      {
        misconceptionId: misconception.id,
        misconceptionCode: misconception.code,
        difficulty,
        steps: steps.map((s) => ({
          phase: s.phase,
          itemIds: s.items.map((item) => item.id),
          explanation: s.explanation,
        })),
      },
      orgId,
    );
  }

  return { steps };
}

// -------------------------------------------------
// Phase 1: 선수 개념 복습 문항 조회
// -------------------------------------------------

/**
 * 관련 스킬의 선수 스킬에 태그된 승인 문항을 조회한다.
 * 난이도가 기준 이하인 쉬운 문항만 반환한다.
 */
async function fetchPrerequisiteReviewItems(
  relatedSkillIds: ReadonlyArray<string>,
  orgId: string,
  difficulty: number,
  limit: number,
  excludeIds: ReadonlySet<string>,
): Promise<ReadonlyArray<ItemWithRelations>> {
  // 선수 스킬 ID 조회 (fromSkillId가 선수, toSkillId가 후속)
  const prerequisiteEdges = await prisma.prerequisiteEdge.findMany({
    where: {
      orgId,
      toSkillId: { in: [...relatedSkillIds] },
    },
    select: { fromSkillId: true },
  });

  const prerequisiteSkillIds: string[] = Array.from(
    new Set(prerequisiteEdges.map((e: { fromSkillId: string }) => e.fromSkillId)),
  );

  if (prerequisiteSkillIds.length === 0) {
    return [];
  }

  const where = buildItemWhereClause(
    prerequisiteSkillIds,
    orgId,
    excludeIds,
    { lte: difficulty },
  );

  return prisma.item.findMany({
    where,
    include: ITEM_INCLUDE,
    orderBy: { difficultyAuthor: "asc" },
    take: limit,
  });
}

// -------------------------------------------------
// Phase 2: 기본 연습 문항 조회
// -------------------------------------------------

/**
 * 관련 스킬에 직접 태그된 승인 문항을 조회한다.
 * 난이도가 기준 +/- 1 범위의 문항만 반환한다.
 */
async function fetchBasicPracticeItems(
  relatedSkillIds: ReadonlyArray<string>,
  orgId: string,
  difficulty: number,
  limit: number,
  excludeIds: ReadonlySet<string>,
): Promise<ReadonlyArray<ItemWithRelations>> {
  const where = buildItemWhereClause(
    [...relatedSkillIds],
    orgId,
    excludeIds,
    { gte: Math.max(1, difficulty - 1), lte: Math.min(5, difficulty + 1) },
  );

  return prisma.item.findMany({
    where,
    include: ITEM_INCLUDE,
    orderBy: { difficultyAuthor: "asc" },
    take: limit,
  });
}

// -------------------------------------------------
// Phase 3: 확인 심화 문항 조회
// -------------------------------------------------

/**
 * 관련 스킬에 직접 태그된 승인 문항 중 난이도가 높은 심화 문항을 조회한다.
 */
async function fetchConfirmationItems(
  relatedSkillIds: ReadonlyArray<string>,
  orgId: string,
  difficulty: number,
  limit: number,
  excludeIds: ReadonlySet<string>,
): Promise<ReadonlyArray<ItemWithRelations>> {
  const where = buildItemWhereClause(
    [...relatedSkillIds],
    orgId,
    excludeIds,
    { gte: difficulty },
  );

  return prisma.item.findMany({
    where,
    include: ITEM_INCLUDE,
    orderBy: { difficultyAuthor: "desc" },
    take: limit,
  });
}

// -------------------------------------------------
// 내부 헬퍼 함수
// -------------------------------------------------

/** 승인 문항 조회를 위한 공통 where 절을 생성한다. approved 우선, 없으면 draft 포함. */
function buildItemWhereClause(
  skillIds: ReadonlyArray<string>,
  orgId: string,
  excludeIds: ReadonlySet<string>,
  difficultyFilter: { gte?: number; lte?: number },
): Prisma.ItemWhereInput {
  return {
    orgId,
    status: { in: ["approved", "reviewed", "draft"] },
    skills: {
      some: { skillId: { in: [...skillIds] } },
    },
    ...(excludeIds.size > 0 && {
      id: { notIn: [...excludeIds] },
    }),
    OR: [
      { difficultyAuthor: difficultyFilter },
      { difficultyAuthor: null },
    ],
  };
}

/** 선택된 문항 ID를 집합에 추가한다 (불변성 대신 Set mutation - 로컬 축적용) */
function addToSelectedIds(
  selectedIds: Set<string>,
  items: ReadonlyArray<ItemWithRelations>,
): void {
  for (const item of items) {
    selectedIds.add(item.id);
  }
}
