// 메타데이터 태깅 서비스
// 문항과 스킬/성취기준/오개념 간의 관계를 관리하며, ltree 기반 분류 검색을 지원한다.
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 반환 타입 정의
// -------------------------------------------------

export interface SkillWithPrimary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly topicPath: string;
  readonly bloomLevel: number | null;
  readonly isPrimary: boolean;
}

export interface MetadataCompleteness {
  readonly score: number; // 0-1 종합 점수
  readonly hasSkills: boolean;
  readonly hasStandards: boolean;
  readonly hasMisconceptions: boolean;
  readonly hasDifficulty: boolean;
  readonly hasTopicPath: boolean;
}

// -------------------------------------------------
// 내부 유틸리티
// -------------------------------------------------

/** 트랜잭션 또는 기본 prisma 클라이언트를 반환 */
function getClient(tx?: TxClient) {
  return tx ?? prisma;
}

/** 문항 존재 및 조직 소속 확인 */
async function verifyItemOwnership(
  itemId: string,
  orgId: string,
  client: TxClient | typeof prisma,
): Promise<void> {
  const item = await client.item.findUnique({
    where: { id: itemId },
    select: { id: true, orgId: true },
  });

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `문항을 찾을 수 없습니다: ${itemId}`,
    });
  }

  if (item.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 문항이 아닙니다",
    });
  }
}

/** 스킬 ID 목록의 존재 및 조직 소속 일괄 확인 */
async function validateSkillIds(
  skillIds: readonly string[],
  orgId: string,
  client: TxClient | typeof prisma,
): Promise<void> {
  if (skillIds.length === 0) return;

  const found = await client.skill.findMany({
    where: { id: { in: [...skillIds] }, orgId },
    select: { id: true },
  });

  if (found.length !== skillIds.length) {
    const foundIds = new Set(found.map((s: { id: string }) => s.id));
    const missing = skillIds.filter((id: string) => !foundIds.has(id));
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `존재하지 않거나 해당 조직에 속하지 않는 성취기준: ${missing.join(", ")}`,
    });
  }
}

/** 성취기준 ID 목록의 존재 및 조직 소속 일괄 확인 */
async function validateStandardIds(
  standardIds: readonly string[],
  orgId: string,
  client: TxClient | typeof prisma,
): Promise<void> {
  if (standardIds.length === 0) return;

  const found = await client.standard.findMany({
    where: { id: { in: [...standardIds] }, orgId },
    select: { id: true },
  });

  if (found.length !== standardIds.length) {
    const foundIds = new Set(found.map((s: { id: string }) => s.id));
    const missing = standardIds.filter((id: string) => !foundIds.has(id));
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `존재하지 않거나 해당 조직에 속하지 않는 성취기준: ${missing.join(", ")}`,
    });
  }
}

/** 오개념 ID 목록의 존재 및 조직 소속 일괄 확인 */
async function validateMisconceptionIds(
  misconceptionIds: readonly string[],
  orgId: string,
  client: TxClient | typeof prisma,
): Promise<void> {
  if (misconceptionIds.length === 0) return;

  const found = await client.misconception.findMany({
    where: { id: { in: [...misconceptionIds] }, orgId },
    select: { id: true },
  });

  if (found.length !== misconceptionIds.length) {
    const foundIds = new Set(found.map((m: { id: string }) => m.id));
    const missing = misconceptionIds.filter((id: string) => !foundIds.has(id));
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `존재하지 않거나 해당 조직에 속하지 않는 오개념: ${missing.join(", ")}`,
    });
  }
}

// -------------------------------------------------
// 스킬 연결
// -------------------------------------------------

/** 문항에 스킬을 연결한다. 첫 번째 스킬이 primary. */
export async function linkSkillsToItem(
  itemId: string,
  skillIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateSkillIds(skillIds, orgId, client);

  if (skillIds.length === 0) return;

  await client.itemSkill.createMany({
    data: skillIds.map((skillId, index) => ({
      itemId,
      skillId,
      isPrimary: index === 0,
    })),
  });
}

/** 문항의 스킬 연결을 갱신한다 (기존 삭제 후 재생성). */
export async function updateItemSkills(
  itemId: string,
  skillIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateSkillIds(skillIds, orgId, client);

  await client.itemSkill.deleteMany({ where: { itemId } });

  if (skillIds.length === 0) return;

  await client.itemSkill.createMany({
    data: skillIds.map((skillId, index) => ({
      itemId,
      skillId,
      isPrimary: index === 0,
    })),
  });
}

/** 문항에 연결된 스킬 목록 조회 */
export async function getItemSkills(
  itemId: string,
  orgId: string,
): Promise<SkillWithPrimary[]> {
  await verifyItemOwnership(itemId, orgId, prisma);

  const itemSkills = await prisma.itemSkill.findMany({
    where: { itemId },
    include: { skill: true },
    orderBy: { isPrimary: "desc" },
  });

  return itemSkills.map(
    (is: { isPrimary: boolean; skill: { id: string; code: string; title: string; topicPath: string; bloomLevel: number | null } }) => ({
      id: is.skill.id,
      code: is.skill.code,
      title: is.skill.title,
      topicPath: is.skill.topicPath,
      bloomLevel: is.skill.bloomLevel,
      isPrimary: is.isPrimary,
    }),
  );
}

// -------------------------------------------------
// 성취기준 연결
// -------------------------------------------------

/** 문항에 성취기준을 연결한다. */
export async function linkStandardsToItem(
  itemId: string,
  standardIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateStandardIds(standardIds, orgId, client);

  if (standardIds.length === 0) return;

  await client.itemStandard.createMany({
    data: standardIds.map((standardId) => ({
      itemId,
      standardId,
    })),
  });
}

/** 문항의 성취기준 연결을 갱신한다. */
export async function updateItemStandards(
  itemId: string,
  standardIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateStandardIds(standardIds, orgId, client);

  await client.itemStandard.deleteMany({ where: { itemId } });

  if (standardIds.length === 0) return;

  await client.itemStandard.createMany({
    data: standardIds.map((standardId) => ({
      itemId,
      standardId,
    })),
  });
}

/** 문항에 연결된 성취기준 목록 조회 */
export async function getItemStandards(
  itemId: string,
  orgId: string,
) {
  await verifyItemOwnership(itemId, orgId, prisma);

  const itemStandards = await prisma.itemStandard.findMany({
    where: { itemId },
    include: { standard: true },
    orderBy: { standard: { code: "asc" } },
  });

  return itemStandards.map((is: { standard: Record<string, unknown> }) => is.standard);
}

// -------------------------------------------------
// 오개념 연결
// -------------------------------------------------

/** 문항에 오개념을 연결한다. */
export async function linkMisconceptionsToItem(
  itemId: string,
  misconceptionIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateMisconceptionIds(misconceptionIds, orgId, client);

  if (misconceptionIds.length === 0) return;

  await client.itemMisconception.createMany({
    data: misconceptionIds.map((misconceptionId) => ({
      itemId,
      misconceptionId,
    })),
  });
}

/** 문항의 오개념 연결을 갱신한다. */
export async function updateItemMisconceptions(
  itemId: string,
  misconceptionIds: string[],
  orgId: string,
  tx?: TxClient,
): Promise<void> {
  const client = getClient(tx);

  await verifyItemOwnership(itemId, orgId, client);
  await validateMisconceptionIds(misconceptionIds, orgId, client);

  await client.itemMisconception.deleteMany({ where: { itemId } });

  if (misconceptionIds.length === 0) return;

  await client.itemMisconception.createMany({
    data: misconceptionIds.map((misconceptionId) => ({
      itemId,
      misconceptionId,
    })),
  });
}

/** 문항에 연결된 오개념 목록 조회 */
export async function getItemMisconceptions(
  itemId: string,
  orgId: string,
) {
  await verifyItemOwnership(itemId, orgId, prisma);

  const itemMisconceptions = await prisma.itemMisconception.findMany({
    where: { itemId },
    include: { misconception: true },
    orderBy: { misconception: { code: "asc" } },
  });

  return itemMisconceptions.map((im: { misconception: Record<string, unknown> }) => im.misconception);
}

// -------------------------------------------------
// ltree 분류 검색
// -------------------------------------------------

/** topicPath(ltree)로 스킬 검색 (하위 포함) */
export async function findSkillsByTopicPath(
  topicPath: string,
  orgId: string,
) {
  // ltree <@ 연산자로 topicPath 하위 전체 검색
  const skills = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      title: string;
      topicPath: string;
      bloomLevel: number | null;
    }>
  >`
    SELECT id, code, title, "topicPath", "bloomLevel"
    FROM skills
    WHERE "orgId" = ${orgId}
      AND "topicPath" <@ ${topicPath}::ltree
    ORDER BY "topicPath"
  `;

  return skills;
}

/** topicPath(ltree)로 성취기준 검색 (하위 포함) */
export async function findStandardsByTopicPath(
  topicPath: string,
  orgId: string,
) {
  const standards = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      title: string;
      schoolLevel: string;
      grade: number;
      topicPath: string;
    }>
  >`
    SELECT id, code, title, "schoolLevel"::text, grade, "topicPath"
    FROM standards
    WHERE "orgId" = ${orgId}
      AND "topicPath" <@ ${topicPath}::ltree
    ORDER BY "topicPath"
  `;

  return standards;
}

// -------------------------------------------------
// 메타데이터 완전성
// -------------------------------------------------

/** 각 메타데이터 항목의 가중치 */
const COMPLETENESS_WEIGHTS = {
  skills: 0.3,
  standards: 0.25,
  misconceptions: 0.15,
  difficulty: 0.15,
  topicPath: 0.15,
} as const;

/** 문항의 메타데이터 완전성을 계산한다 (0-1 비율) */
export async function calculateMetadataCompleteness(
  itemId: string,
  orgId: string,
): Promise<MetadataCompleteness> {
  // 문항 기본 정보 + 연결 개수를 병렬 조회
  const [item, skillCount, standardCount, misconceptionCount] =
    await Promise.all([
      prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          orgId: true,
          difficultyAuthor: true,
          topicPath: true,
        },
      }),
      prisma.itemSkill.count({ where: { itemId } }),
      prisma.itemStandard.count({ where: { itemId } }),
      prisma.itemMisconception.count({ where: { itemId } }),
    ]);

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `문항을 찾을 수 없습니다: ${itemId}`,
    });
  }

  if (item.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 문항이 아닙니다",
    });
  }

  const hasSkills = skillCount > 0;
  const hasStandards = standardCount > 0;
  const hasMisconceptions = misconceptionCount > 0;
  const hasDifficulty = item.difficultyAuthor != null;
  const hasTopicPath = item.topicPath != null;

  // 가중 합산으로 종합 점수 계산
  const score =
    (hasSkills ? COMPLETENESS_WEIGHTS.skills : 0) +
    (hasStandards ? COMPLETENESS_WEIGHTS.standards : 0) +
    (hasMisconceptions ? COMPLETENESS_WEIGHTS.misconceptions : 0) +
    (hasDifficulty ? COMPLETENESS_WEIGHTS.difficulty : 0) +
    (hasTopicPath ? COMPLETENESS_WEIGHTS.topicPath : 0);

  return {
    score,
    hasSkills,
    hasStandards,
    hasMisconceptions,
    hasDifficulty,
    hasTopicPath,
  };
}
