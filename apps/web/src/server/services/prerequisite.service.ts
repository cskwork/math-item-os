// 선수 학습 관계(DAG) 엣지 서비스
// 자기 참조 방지, 중복 방지, 재귀 CTE 기반 순환 감지
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { EdgeStrength, Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 입력 타입 정의
// -------------------------------------------------

export interface CreatePrerequisiteEdgeInput {
  readonly fromSkillId: string;
  readonly toSkillId: string;
  readonly strength: EdgeStrength;
  readonly weight?: number;
}

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

const EDGE_INCLUDE = {
  fromSkill: true,
  toSkill: true,
} satisfies Prisma.PrerequisiteEdgeInclude;

// -------------------------------------------------
// 1. 선수 학습 관계 생성
// -------------------------------------------------

/**
 * 선수 학습 관계(엣지)를 생성한다.
 * - 자기 참조 검증 (from === to 차단)
 * - 중복 검증 (동일 org 내 from-to 쌍 유일)
 * - 재귀 CTE로 DAG 순환 감지
 * - 감사 로그 기록
 */
export async function createPrerequisiteEdge(
  input: CreatePrerequisiteEdgeInput,
  userId: string,
  orgId: string,
) {
  // 자기 참조 검증
  if (input.fromSkillId === input.toSkillId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "SELF_REFERENCE",
    });
  }

  // 중복 검증
  const existing = await prisma.prerequisiteEdge.findUnique({
    where: {
      orgId_fromSkillId_toSkillId: {
        orgId,
        fromSkillId: input.fromSkillId,
        toSkillId: input.toSkillId,
      },
    },
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "DUPLICATE_EDGE",
    });
  }

  // 재귀 CTE로 순환 감지
  // toSkillId에서 출발하여 기존 엣지를 따라 모든 후손(descendants)을 탐색
  // 후손 중 fromSkillId가 존재하면 이 엣지 추가 시 순환이 발생
  const cycleResult = await prisma.$queryRaw<ReadonlyArray<{ has_cycle: boolean }>>`
    WITH RECURSIVE descendants AS (
      SELECT to_skill_id AS skill_id
      FROM prerequisite_edges
      WHERE from_skill_id = ${input.toSkillId} AND org_id = ${orgId}

      UNION

      SELECT pe.to_skill_id
      FROM prerequisite_edges pe
      INNER JOIN descendants d ON pe.from_skill_id = d.skill_id
      WHERE pe.org_id = ${orgId}
    )
    SELECT EXISTS (
      SELECT 1 FROM descendants WHERE skill_id = ${input.fromSkillId}
    ) AS has_cycle
  `;

  if (cycleResult[0]?.has_cycle) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CYCLE_DETECTED",
    });
  }

  // 트랜잭션 내에서 엣지 생성 + 감사 로그
  const edge = await prisma.$transaction(async (tx: TxClient) => {
    const created = await tx.prerequisiteEdge.create({
      data: {
        orgId,
        fromSkillId: input.fromSkillId,
        toSkillId: input.toSkillId,
        strength: input.strength,
        weight: input.weight ?? 1.0,
      },
      include: EDGE_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "prerequisite_edges",
        recordId: created.id,
        action: "create",
        performedBy: userId,
        newData: {
          fromSkillId: input.fromSkillId,
          toSkillId: input.toSkillId,
          strength: input.strength,
          weight: input.weight ?? 1.0,
        } as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  return { edge };
}

// -------------------------------------------------
// 2. 선수 학습 관계 삭제
// -------------------------------------------------

/**
 * 선수 학습 관계(엣지)를 삭제한다.
 * - 조직 소속 확인 후 삭제
 * - 감사 로그 기록
 */
export async function deletePrerequisiteEdge(
  edgeId: string,
  userId: string,
  orgId: string,
) {
  const existing = await prisma.prerequisiteEdge.findUnique({
    where: { id: edgeId },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `선수 학습 관계를 찾을 수 없습니다: ${edgeId}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 선수 학습 관계가 아닙니다",
    });
  }

  await prisma.$transaction(async (tx: TxClient) => {
    await tx.prerequisiteEdge.delete({
      where: { id: edgeId },
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "prerequisite_edges",
        recordId: edgeId,
        action: "delete",
        performedBy: userId,
        oldData: {
          fromSkillId: existing.fromSkillId,
          toSkillId: existing.toSkillId,
          strength: existing.strength,
          weight: existing.weight,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return { success: true as const };
}

// -------------------------------------------------
// 3. 선수 학습 관계 목록 조회
// -------------------------------------------------

/**
 * 선수 학습 관계 목록을 조회한다.
 * - skillId가 지정되면 해당 스킬과 연결된 엣지만 반환 (from 또는 to)
 * - fromSkill, toSkill 관계를 포함하여 반환
 */
export async function listPrerequisiteEdges(params: {
  readonly skillId?: string;
  readonly orgId: string;
}) {
  const where: Prisma.PrerequisiteEdgeWhereInput = {
    orgId: params.orgId,
    ...(params.skillId != null && {
      OR: [
        { fromSkillId: params.skillId },
        { toSkillId: params.skillId },
      ],
    }),
  };

  const edges = await prisma.prerequisiteEdge.findMany({
    where,
    include: EDGE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return { edges };
}

// -------------------------------------------------
// 입력 타입 정의 - 그래프 조회
// -------------------------------------------------

export interface GetPrerequisiteGraphParams {
  readonly skillId: string;
  readonly depth: number;
  readonly direction: "ancestors" | "descendants" | "both";
}

// -------------------------------------------------
// 재귀 CTE 결과 타입
// -------------------------------------------------

interface RawTraversalRow {
  readonly skill_id: string;
}

// -------------------------------------------------
// 4. 선수 학습 그래프 조회 (DAG 순회)
// -------------------------------------------------

/**
 * 재귀 CTE로 조상(ancestors) 또는 후손(descendants) 스킬 ID를 탐색한다.
 * - ancestors: 주어진 스킬의 선수 학습 스킬 (to_skill_id → from_skill_id 방향 역추적)
 * - descendants: 주어진 스킬을 선수 학습으로 요구하는 스킬 (from_skill_id → to_skill_id 방향 추적)
 */
async function traverseAncestors(
  skillId: string,
  orgId: string,
  depth: number,
): Promise<ReadonlyArray<string>> {
  const rows = await prisma.$queryRaw<ReadonlyArray<RawTraversalRow>>`
    WITH RECURSIVE ancestors AS (
      SELECT from_skill_id AS skill_id, 1 AS depth
      FROM prerequisite_edges
      WHERE to_skill_id = ${skillId} AND org_id = ${orgId}

      UNION

      SELECT pe.from_skill_id, a.depth + 1
      FROM prerequisite_edges pe
      INNER JOIN ancestors a ON pe.to_skill_id = a.skill_id
      WHERE pe.org_id = ${orgId} AND a.depth < ${depth}
    )
    SELECT DISTINCT skill_id FROM ancestors
  `;
  return rows.map((r) => r.skill_id);
}

async function traverseDescendants(
  skillId: string,
  orgId: string,
  depth: number,
): Promise<ReadonlyArray<string>> {
  const rows = await prisma.$queryRaw<ReadonlyArray<RawTraversalRow>>`
    WITH RECURSIVE descendants AS (
      SELECT to_skill_id AS skill_id, 1 AS depth
      FROM prerequisite_edges
      WHERE from_skill_id = ${skillId} AND org_id = ${orgId}

      UNION

      SELECT pe.to_skill_id, d.depth + 1
      FROM prerequisite_edges pe
      INNER JOIN descendants d ON pe.from_skill_id = d.skill_id
      WHERE pe.org_id = ${orgId} AND d.depth < ${depth}
    )
    SELECT DISTINCT skill_id FROM descendants
  `;
  return rows.map((r) => r.skill_id);
}

/**
 * 선수 학습 그래프를 조회한다.
 * - 재귀 CTE로 조상/후손 노드를 탐색
 * - 각 노드에 연결된 아이템 수와 난이도 분포를 계산
 * - 탐색된 노드 간 모든 엣지를 반환
 */
export async function getPrerequisiteGraph(
  params: GetPrerequisiteGraphParams,
  orgId: string,
) {
  const { skillId, depth, direction } = params;

  // 루트 스킬 존재 및 조직 소속 확인
  const rootSkill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!rootSkill) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `스킬을 찾을 수 없습니다: ${skillId}`,
    });
  }

  if (rootSkill.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 스킬이 아닙니다",
    });
  }

  // 방향에 따라 재귀 CTE 실행
  let traversedIds: ReadonlyArray<string> = [];

  if (direction === "ancestors" || direction === "both") {
    const ancestorIds = await traverseAncestors(skillId, orgId, depth);
    traversedIds = [...traversedIds, ...ancestorIds];
  }

  if (direction === "descendants" || direction === "both") {
    const descendantIds = await traverseDescendants(skillId, orgId, depth);
    traversedIds = [...traversedIds, ...descendantIds];
  }

  // 루트 스킬 포함, 중복 제거
  const allSkillIds = [...new Set([skillId, ...traversedIds])];

  // 전체 스킬 데이터 조회
  const skills = await prisma.skill.findMany({
    where: { id: { in: allSkillIds } },
  });

  // 각 스킬별 아이템 수 및 난이도 분포 계산
  const itemStats = await prisma.itemSkill.findMany({
    where: { skillId: { in: allSkillIds } },
    select: {
      skillId: true,
      item: {
        select: { difficultyAuthor: true },
      },
    },
  });

  // skillId별 아이템 수 및 난이도 분포 집계
  const statsMap = new Map<
    string,
    { itemCount: number; difficultyDistribution: Record<number, number> }
  >();

  for (const stat of itemStats) {
    const existing = statsMap.get(stat.skillId) ?? {
      itemCount: 0,
      difficultyDistribution: {} as Record<number, number>,
    };

    const updatedCount = existing.itemCount + 1;
    const difficulty = stat.item.difficultyAuthor;

    // 난이도가 설정된 경우에만 분포에 포함
    const updatedDistribution = { ...existing.difficultyDistribution };
    if (difficulty != null) {
      updatedDistribution[difficulty] =
        (updatedDistribution[difficulty] ?? 0) + 1;
    }

    statsMap.set(stat.skillId, {
      itemCount: updatedCount,
      difficultyDistribution: updatedDistribution,
    });
  }

  // 노드 배열 구성
  const nodes = skills.map((skill) => {
    const stats = statsMap.get(skill.id) ?? {
      itemCount: 0,
      difficultyDistribution: {},
    };
    return {
      skill,
      itemCount: stats.itemCount,
      difficultyDistribution: stats.difficultyDistribution,
    };
  });

  // 탐색된 노드 간 모든 엣지 조회
  const graphEdges = await prisma.prerequisiteEdge.findMany({
    where: {
      orgId,
      fromSkillId: { in: allSkillIds },
      toSkillId: { in: allSkillIds },
    },
  });

  const edges = graphEdges.map((edge) => ({
    from: edge.fromSkillId,
    to: edge.toSkillId,
    strength: edge.strength,
    weight: Number(edge.weight),
  }));

  return { nodes, edges };
}
