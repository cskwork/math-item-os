// 스킬 CRUD 서비스 - ltree 경로 관리 및 감사 로그 연동
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Subject, Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -- 입력 타입 정의 --

export interface CreateSkillInput {
  readonly subject?: Subject;
  readonly code: string;
  readonly title: string;
  readonly description?: string;
  readonly topicPath: string;
  readonly bloomLevel?: number;
  readonly estimatedTimeMin?: number;
  readonly typeLevel?: number;
}

export interface UpdateSkillInput {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly topicPath?: string;
  readonly bloomLevel?: number;
  readonly estimatedTimeMin?: number;
  readonly typeLevel?: number;
}

export interface ListSkillsParams {
  readonly subject?: Subject;
  readonly topicPath?: string;
  readonly bloomLevel?: number;
  readonly typeLevel?: number;
  readonly page: number;
  readonly limit: number;
}

export interface GetSkillItemsParams {
  readonly skillId: string;
  readonly page: number;
  readonly limit: number;
  readonly sortBy?: "difficultyAuthor" | "createdAt";
}

// -- 관계 포함 공통 include --

const SKILL_DETAIL_INCLUDE = {
  _count: {
    select: { items: true },
  },
  prerequisitesFrom: {
    include: { toSkill: true },
  },
  prerequisitesTo: {
    include: { fromSkill: true },
  },
} satisfies Prisma.SkillInclude;

// -- 1. 스킬 생성 --

/** 새 스킬을 생성한다. 조직 내 코드 중복 검사 + 감사 로그 기록. */
export async function createSkill(
  input: CreateSkillInput,
  userId: string,
  orgId: string,
) {
  return prisma.$transaction(async (tx: TxClient) => {
    // 조직 내 코드 중복 검사
    const existing = await tx.skill.findUnique({
      where: { orgId_code: { orgId, code: input.code } },
      select: { id: true },
    });

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "DUPLICATE_CODE",
      });
    }

    // 스킬 레코드 생성
    const created = await tx.skill.create({
      data: {
        orgId,
        subject: input.subject ?? "MATH",
        code: input.code,
        title: input.title,
        description: input.description,
        topicPath: input.topicPath,
        bloomLevel: input.bloomLevel,
        estimatedTimeMin: input.estimatedTimeMin,
        typeLevel: input.typeLevel,
      },
      include: SKILL_DETAIL_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "skills",
        recordId: created.id,
        action: "create",
        performedBy: userId,
        newData: {
          code: input.code,
          title: input.title,
          topicPath: input.topicPath,
          bloomLevel: input.bloomLevel,
          typeLevel: input.typeLevel,
        } as Prisma.InputJsonValue,
      },
    });

    return { skill: created };
  });
}

// -- 2. 스킬 수정 --

/** 기존 스킬을 수정한다. 변경된 필드만 업데이트 + old/new 감사 로그 기록. */
export async function updateSkill(
  input: UpdateSkillInput,
  userId: string,
  orgId: string,
) {
  // 기존 스킬 조회 및 소속 확인
  const existing = await prisma.skill.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orgId: true,
      title: true,
      description: true,
      topicPath: true,
      bloomLevel: true,
      estimatedTimeMin: true,
      typeLevel: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `스킬을 찾을 수 없습니다: ${input.id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 스킬이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 변경 가능한 필드만 추출하여 업데이트 데이터 구성
    const updateData: Prisma.SkillUpdateInput = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.topicPath !== undefined && { topicPath: input.topicPath }),
      ...(input.bloomLevel !== undefined && { bloomLevel: input.bloomLevel }),
      ...(input.estimatedTimeMin !== undefined && {
        estimatedTimeMin: input.estimatedTimeMin,
      }),
      ...(input.typeLevel !== undefined && { typeLevel: input.typeLevel }),
    };

    const updated = await tx.skill.update({
      where: { id: input.id },
      data: updateData,
      include: SKILL_DETAIL_INCLUDE,
    });

    // 감사 로그 기록 (변경 전/후 데이터)
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "skills",
        recordId: input.id,
        action: "update",
        performedBy: userId,
        oldData: {
          title: existing.title,
          description: existing.description,
          topicPath: existing.topicPath,
          bloomLevel: existing.bloomLevel,
          estimatedTimeMin: existing.estimatedTimeMin,
          typeLevel: existing.typeLevel,
        } as Prisma.InputJsonValue,
        newData: {
          title: updated.title,
          description: updated.description,
          topicPath: updated.topicPath,
          bloomLevel: updated.bloomLevel,
          estimatedTimeMin: updated.estimatedTimeMin,
          typeLevel: updated.typeLevel,
        } as Prisma.InputJsonValue,
      },
    });

    return { skill: updated };
  });
}

// -- 3. 스킬 삭제 --

/** 스킬을 삭제한다. cascade로 간선/ItemSkill 자동 삭제 + 감사 로그 기록. */
export async function deleteSkill(
  id: string,
  userId: string,
  orgId: string,
) {
  // 기존 스킬 조회 및 소속 확인
  const existing = await prisma.skill.findUnique({
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
      message: `스킬을 찾을 수 없습니다: ${id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 스킬이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 스킬 삭제 (cascade로 간선/ItemSkill 자동 삭제)
    await tx.skill.delete({ where: { id } });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "skills",
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

// -- 4. 스킬 단건 조회 --

/** ID로 스킬을 조회한다. 문항 수, 선행/후행 스킬 관계 포함. */
export async function getSkillById(id: string, orgId: string) {
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: SKILL_DETAIL_INCLUDE,
  });

  if (!skill) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `스킬을 찾을 수 없습니다: ${id}`,
    });
  }

  if (skill.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 스킬이 아닙니다",
    });
  }

  return { skill };
}

// -- 5. 스킬 목록 조회 --

/** 필터 + 페이지네이션으로 스킬 목록을 조회한다. ltree 접두사 매칭 지원. */
export async function listSkills(params: ListSkillsParams, orgId: string) {
  const { subject, topicPath, bloomLevel, typeLevel, page, limit } = params;

  // 동적 where 절 구성
  const where: Prisma.SkillWhereInput = {
    orgId,
    ...(subject != null && { subject }),
    ...(topicPath != null && { topicPath: { startsWith: topicPath } }),
    ...(bloomLevel != null && { bloomLevel }),
    ...(typeLevel !== undefined && { typeLevel }),
  };

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { topicPath: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.skill.count({ where }),
  ]);

  return { skills, total, page, limit };
}

// -- 6. 스킬 연결 문항 목록 조회 --

/** 특정 스킬에 연결된 문항 목록을 조회한다. 난이도/생성일 정렬 지원. */
export async function getSkillItems(
  params: GetSkillItemsParams,
  orgId: string,
) {
  const { skillId, page, limit, sortBy = "createdAt" } = params;

  // 스킬 존재 및 소속 확인
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { id: true, orgId: true },
  });

  if (!skill) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `스킬을 찾을 수 없습니다: ${skillId}`,
    });
  }

  if (skill.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 스킬이 아닙니다",
    });
  }

  // 문항 where 절 (해당 스킬에 연결된 문항만)
  const where: Prisma.ItemWhereInput = {
    orgId,
    skills: { some: { skillId } },
  };

  // 허용된 정렬 필드 검증
  const safeSortBy = sortBy === "difficultyAuthor" ? "difficultyAuthor" : "createdAt";

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        skills: { include: { skill: true } },
        standards: { include: { standard: true } },
        misconceptions: { include: { misconception: true } },
      },
      orderBy: { [safeSortBy]: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return { items, total, page, limit };
}
