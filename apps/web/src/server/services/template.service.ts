// 템플릿 CRUD 서비스 - 변형 문항 생성용 템플릿 관리 및 감사 로그 연동
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -- 입력 타입 정의 --

export interface CreateTemplateInput {
  readonly title: string;
  readonly bodyTemplate: string;
  readonly parameters: ReadonlyArray<Record<string, unknown>>;
  readonly answerTemplate: string;
  readonly constraints?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  readonly id: string;
  readonly title?: string;
  readonly bodyTemplate?: string;
  readonly parameters?: ReadonlyArray<Record<string, unknown>>;
  readonly answerTemplate?: string;
  readonly constraints?: Record<string, unknown>;
}

export interface ListTemplatesParams {
  readonly page: number;
  readonly limit: number;
}

// -- 관계 포함 공통 include --

const TEMPLATE_DETAIL_INCLUDE = {
  _count: {
    select: { variants: true },
  },
} satisfies Prisma.TemplateInclude;

// -- 1. 템플릿 생성 --

/** 새 템플릿을 생성한다. 감사 로그 기록 포함. */
export async function createTemplate(
  input: CreateTemplateInput,
  performedBy: string,
  orgId: string,
) {
  return prisma.$transaction(async (tx: TxClient) => {
    // 템플릿 레코드 생성
    const created = await tx.template.create({
      data: {
        orgId,
        title: input.title,
        bodyTemplate: input.bodyTemplate,
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        answerTemplate: input.answerTemplate,
        constraints: (input.constraints ?? {}) as Prisma.InputJsonValue,
      },
      include: TEMPLATE_DETAIL_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "templates",
        recordId: created.id,
        action: "create",
        performedBy,
        newData: {
          title: input.title,
          bodyTemplate: input.bodyTemplate,
          answerTemplate: input.answerTemplate,
        } as Prisma.InputJsonValue,
      },
    });

    return { template: created };
  });
}

// -- 2. 템플릿 수정 --

/** 기존 템플릿을 수정한다. 변경된 필드만 업데이트 + old/new 감사 로그 기록. */
export async function updateTemplate(
  input: UpdateTemplateInput,
  performedBy: string,
  orgId: string,
) {
  // 기존 템플릿 조회 및 소속 확인
  const existing = await prisma.template.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orgId: true,
      title: true,
      bodyTemplate: true,
      parameters: true,
      answerTemplate: true,
      constraints: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `템플릿을 찾을 수 없습니다: ${input.id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 템플릿이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 변경 가능한 필드만 추출하여 업데이트 데이터 구성
    const updateData: Prisma.TemplateUpdateInput = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.bodyTemplate !== undefined && { bodyTemplate: input.bodyTemplate }),
      ...(input.parameters !== undefined && {
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
      }),
      ...(input.answerTemplate !== undefined && { answerTemplate: input.answerTemplate }),
      ...(input.constraints !== undefined && {
        constraints: input.constraints as Prisma.InputJsonValue,
      }),
    };

    const updated = await tx.template.update({
      where: { id: input.id },
      data: updateData,
      include: TEMPLATE_DETAIL_INCLUDE,
    });

    // 감사 로그 기록 (변경 전/후 데이터)
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "templates",
        recordId: input.id,
        action: "update",
        performedBy,
        oldData: {
          title: existing.title,
          bodyTemplate: existing.bodyTemplate,
          answerTemplate: existing.answerTemplate,
        } as Prisma.InputJsonValue,
        newData: {
          title: updated.title,
          bodyTemplate: updated.bodyTemplate,
          answerTemplate: updated.answerTemplate,
        } as Prisma.InputJsonValue,
      },
    });

    return { template: updated };
  });
}

// -- 3. 템플릿 삭제 --

/** 템플릿을 삭제한다. 감사 로그 기록 포함. */
export async function deleteTemplate(
  id: string,
  performedBy: string,
  orgId: string,
) {
  // 기존 템플릿 조회 및 소속 확인
  const existing = await prisma.template.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      title: true,
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `템플릿을 찾을 수 없습니다: ${id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 템플릿이 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 템플릿 삭제
    await tx.template.delete({ where: { id } });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "templates",
        recordId: id,
        action: "delete",
        performedBy,
        oldData: {
          title: existing.title,
        } as Prisma.InputJsonValue,
      },
    });

    return { success: true as const };
  });
}

// -- 4. 템플릿 단건 조회 --

/** ID로 템플릿을 조회한다. 연결된 변형 문항 수 포함. */
export async function getTemplateById(id: string, orgId: string) {
  const template = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_DETAIL_INCLUDE,
  });

  if (!template) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `템플릿을 찾을 수 없습니다: ${id}`,
    });
  }

  if (template.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 템플릿이 아닙니다",
    });
  }

  return { template };
}

// -- 5. 템플릿 목록 조회 --

/** 페이지네이션으로 템플릿 목록을 조회한다. 변형 문항 수 포함. */
export async function listTemplates(
  params: ListTemplatesParams,
  orgId: string,
) {
  const { page, limit } = params;

  const where: Prisma.TemplateWhereInput = { orgId };

  const [templates, total] = await Promise.all([
    prisma.template.findMany({
      where,
      include: TEMPLATE_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.template.count({ where }),
  ]);

  return { templates, total, page, limit };
}

// -- 6. 변형 문항 수 원자적 증가 --

/** 변형 생성 성공 후 variantCount를 원자적으로 증가시킨다. */
export async function incrementVariantCount(
  templateId: string,
  count: number,
) {
  return prisma.template.update({
    where: { id: templateId },
    data: {
      variantCount: { increment: count },
    },
    select: { id: true, variantCount: true },
  });
}
