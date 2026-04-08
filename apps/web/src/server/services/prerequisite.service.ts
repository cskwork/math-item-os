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
