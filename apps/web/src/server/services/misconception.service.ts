// 오개념 CRUD 서비스 - relatedSkills 검증 및 감사 로그 연동
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -- 입력 타입 정의 --

export interface CreateMisconceptionInput {
  readonly code: string;
  readonly title: string;
  readonly typicalError?: string;
  readonly remediation?: string;
  readonly severity?: number;
  readonly relatedSkillIds?: string[];
}

export interface UpdateMisconceptionInput {
  readonly id: string;
  readonly title?: string;
  readonly typicalError?: string;
  readonly remediation?: string;
  readonly severity?: number;
  readonly relatedSkillIds?: string[];
}

export interface ListMisconceptionsParams {
  readonly skillId?: string;
  readonly severity?: number;
  readonly page: number;
  readonly limit: number;
}

// -- 관계 포함 공통 include --

const MISCONCEPTION_DETAIL_INCLUDE = {
  _count: {
    select: { items: true },
  },
} satisfies Prisma.MisconceptionInclude;

// -- 헬퍼: relatedSkillIds 존재 검증 --

/** 주어진 스킬 ID들이 해당 조직에 모두 존재하는지 검증한다. */
async function validateRelatedSkillIds(
  tx: TxClient,
  orgId: string,
  skillIds: readonly string[],
): Promise<void> {
  if (skillIds.length === 0) return;

  const existingCount = await tx.skill.count({
    where: {
      orgId,
      id: { in: [...skillIds] },
    },
  });

  if (existingCount !== skillIds.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "일부 relatedSkillIds가 존재하지 않습니다",
    });
  }
}

// -- 1. 오개념 생성 --

/** 새 오개념을 생성한다. 조직 내 코드 중복 검사 + relatedSkillIds 검증 + 감사 로그 기록. */
export async function createMisconception(
  input: CreateMisconceptionInput,
  userId: string,
  orgId: string,
) {
  return prisma.$transaction(async (tx: TxClient) => {
    // 조직 내 코드 중복 검사
    const existing = await tx.misconception.findUnique({
      where: { orgId_code: { orgId, code: input.code } },
      select: { id: true },
    });

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "DUPLICATE_CODE",
      });
    }

    // relatedSkillIds 존재 검증
    const relatedSkillIds = input.relatedSkillIds ?? [];
    if (relatedSkillIds.length > 0) {
      await validateRelatedSkillIds(tx, orgId, relatedSkillIds);
    }

    // 오개념 레코드 생성
    const created = await tx.misconception.create({
      data: {
        orgId,
        code: input.code,
        title: input.title,
        typicalError: input.typicalError,
        remediation: input.remediation,
        severity: input.severity,
        relatedSkills: relatedSkillIds,
      },
      include: MISCONCEPTION_DETAIL_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "misconceptions",
        recordId: created.id,
        action: "create",
        performedBy: userId,
        newData: {
          code: input.code,
          title: input.title,
          severity: input.severity,
          relatedSkills: relatedSkillIds,
        } as Prisma.InputJsonValue,
      },
    });

    return { misconception: created };
  });
}

// -- 2. 오개념 수정 --

/** 기존 오개념을 수정한다. 변경된 필드만 업데이트 + old/new 감사 로그 기록. */
export async function updateMisconception(
  input: UpdateMisconceptionInput,
  userId: string,
  orgId: string,
) {
  // 기존 오개념 조회 및 소속 확인
  const existing = await prisma.misconception.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orgId: true,
      title: true,
      typicalError: true,
      remediation: true,
      severity: true,
      relatedSkills: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `오개념을 찾을 수 없습니다: ${input.id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 오개념이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // relatedSkillIds 존재 검증
    if (input.relatedSkillIds !== undefined && input.relatedSkillIds.length > 0) {
      await validateRelatedSkillIds(tx, orgId, input.relatedSkillIds);
    }

    // 변경 가능한 필드만 추출하여 업데이트 데이터 구성
    const updateData: Prisma.MisconceptionUpdateInput = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.typicalError !== undefined && { typicalError: input.typicalError }),
      ...(input.remediation !== undefined && { remediation: input.remediation }),
      ...(input.severity !== undefined && { severity: input.severity }),
      ...(input.relatedSkillIds !== undefined && { relatedSkills: input.relatedSkillIds }),
    };

    const updated = await tx.misconception.update({
      where: { id: input.id },
      data: updateData,
      include: MISCONCEPTION_DETAIL_INCLUDE,
    });

    // 감사 로그 기록 (변경 전/후 데이터)
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "misconceptions",
        recordId: input.id,
        action: "update",
        performedBy: userId,
        oldData: {
          title: existing.title,
          typicalError: existing.typicalError,
          remediation: existing.remediation,
          severity: existing.severity,
          relatedSkills: existing.relatedSkills,
        } as Prisma.InputJsonValue,
        newData: {
          title: updated.title,
          typicalError: updated.typicalError,
          remediation: updated.remediation,
          severity: updated.severity,
          relatedSkills: updated.relatedSkills,
        } as Prisma.InputJsonValue,
      },
    });

    return { misconception: updated };
  });
}

// -- 3. 오개념 삭제 --

/** 오개념을 삭제한다. cascade로 ItemMisconception 자동 삭제 + 감사 로그 기록. */
export async function deleteMisconception(
  id: string,
  userId: string,
  orgId: string,
) {
  // 기존 오개념 조회 및 소속 확인
  const existing = await prisma.misconception.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      code: true,
      title: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `오개념을 찾을 수 없습니다: ${id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 오개념이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 오개념 삭제 (cascade로 ItemMisconception 자동 삭제)
    await tx.misconception.delete({ where: { id } });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "misconceptions",
        recordId: id,
        action: "delete",
        performedBy: userId,
        oldData: {
          code: existing.code,
          title: existing.title,
        } as Prisma.InputJsonValue,
      },
    });

    return { success: true as const };
  });
}

// -- 4. 오개념 단건 조회 --

/** ID로 오개념을 조회한다. 연결된 문항 수 포함. */
export async function getMisconceptionById(id: string, orgId: string) {
  const misconception = await prisma.misconception.findUnique({
    where: { id },
    include: MISCONCEPTION_DETAIL_INCLUDE,
  });

  if (!misconception) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `오개념을 찾을 수 없습니다: ${id}`,
    });
  }

  if (misconception.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 오개념이 아닙니다",
    });
  }

  return { misconception };
}

// -- 5. 오개념 목록 조회 --

/** 필터 + 페이지네이션으로 오개념 목록을 조회한다. skillId, severity 필터 지원. */
export async function listMisconceptions(
  params: ListMisconceptionsParams,
  orgId: string,
) {
  const { skillId, severity, page, limit } = params;

  // 동적 where 절 구성
  const where: Prisma.MisconceptionWhereInput = {
    orgId,
    ...(skillId != null && { relatedSkills: { has: skillId } }),
    ...(severity != null && { severity }),
  };

  const [misconceptions, total] = await Promise.all([
    prisma.misconception.findMany({
      where,
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { code: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.misconception.count({ where }),
  ]);

  return { misconceptions, total, page, limit };
}
