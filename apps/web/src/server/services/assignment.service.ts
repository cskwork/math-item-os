// 학습지(과제) CRUD 서비스 - 목적별 학습지 제작, 문항 배치, 공유 기능
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { AssignmentPurpose, Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 입력 타입 정의
// -------------------------------------------------

export interface CreateAssignmentInput {
  readonly title: string;
  readonly purpose: AssignmentPurpose;
  readonly itemIds: readonly string[];
  readonly points?: readonly number[];
}

export interface UpdateAssignmentItemsInput {
  readonly assignmentId: string;
  readonly itemIds: readonly string[];
  readonly points?: readonly number[];
}

export interface ListAssignmentsParams {
  readonly page: number;
  readonly limit: number;
  readonly purpose?: AssignmentPurpose;
}

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

/** 학습지 상세 조회 시 문항 정보 포함 */
const ASSIGNMENT_DETAIL_INCLUDE = {
  items: {
    include: {
      item: {
        include: {
          skills: { include: { skill: true } },
          difficultyProfile: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.AssignmentInclude;

/** 학습지 목록 조회 시 문항 수만 포함 */
const ASSIGNMENT_LIST_INCLUDE = {
  _count: {
    select: { items: true },
  },
} satisfies Prisma.AssignmentInclude;

// -------------------------------------------------
// 1. 학습지 생성
// -------------------------------------------------

/** 새 학습지를 생성한다. 문항 유효성 검증 + 감사 로그 기록 포함. */
export async function createAssignment(
  input: CreateAssignmentInput,
  performedBy: string,
  orgId: string,
) {
  // points 배열 길이 검증 (제공된 경우 itemIds와 동일해야 함)
  if (input.points && input.points.length !== input.itemIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "points 배열 길이가 itemIds 배열 길이와 일치하지 않습니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 모든 itemIds가 존재하고 해당 조직에 속하는지 검증
    const validItems = await tx.item.findMany({
      where: {
        id: { in: [...input.itemIds] },
        orgId,
      },
      select: { id: true },
    });

    const validItemIds = new Set(
      validItems.map((item: { id: string }) => item.id),
    );
    const invalidIds = input.itemIds.filter(
      (id: string) => !validItemIds.has(id),
    );

    if (invalidIds.length > 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `존재하지 않거나 조직에 속하지 않는 문항입니다: ${invalidIds.join(", ")}`,
      });
    }

    // 학습지 레코드 생성
    const created = await tx.assignment.create({
      data: {
        orgId,
        title: input.title,
        purpose: input.purpose,
        items: {
          create: input.itemIds.map((itemId, index) => ({
            itemId,
            position: index,
            ...(input.points?.[index] != null && {
              points: input.points[index],
            }),
          })),
        },
      },
      include: ASSIGNMENT_DETAIL_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "assignments",
        recordId: created.id,
        action: "assign",
        performedBy,
        newData: {
          title: input.title,
          purpose: input.purpose,
          itemCount: input.itemIds.length,
        } as Prisma.InputJsonValue,
      },
    });

    return { assignment: created };
  });
}

// -------------------------------------------------
// 2. 학습지 단건 조회
// -------------------------------------------------

/** ID로 학습지를 조회한다. 문항 상세(스킬, 난이도 등) 포함, position 순 정렬. */
export async function getAssignmentById(id: string, orgId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: ASSIGNMENT_DETAIL_INCLUDE,
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${id}`,
    });
  }

  if (assignment.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  return { assignment };
}

// -------------------------------------------------
// 3. 학습지 목록 조회
// -------------------------------------------------

/** 페이지네이션 + 목적 필터로 학습지 목록을 조회한다. 문항 수 포함. */
export async function listAssignments(
  params: ListAssignmentsParams,
  orgId: string,
) {
  const { page, limit, purpose } = params;

  const where: Prisma.AssignmentWhereInput = {
    orgId,
    ...(purpose != null && { purpose }),
  };

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: ASSIGNMENT_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.assignment.count({ where }),
  ]);

  return { assignments, total, page, limit };
}

// -------------------------------------------------
// 4. 학습지 문항 교체/재배치
// -------------------------------------------------

/** 학습지의 문항을 교체하거나 순서를 변경한다. 기존 항목 삭제 후 재생성. */
export async function updateAssignmentItems(
  input: UpdateAssignmentItemsInput,
  performedBy: string,
  orgId: string,
) {
  // points 배열 길이 검증
  if (input.points && input.points.length !== input.itemIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "points 배열 길이가 itemIds 배열 길이와 일치하지 않습니다",
    });
  }

  // 기존 학습지 조회 및 소속 확인
  const existing = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: {
      items: {
        orderBy: { position: "asc" },
        select: { itemId: true, position: true, points: true },
      },
    },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${input.assignmentId}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 새 itemIds 유효성 검증
    const validItems = await tx.item.findMany({
      where: {
        id: { in: [...input.itemIds] },
        orgId,
      },
      select: { id: true },
    });

    const validItemIds = new Set(
      validItems.map((item: { id: string }) => item.id),
    );
    const invalidIds = input.itemIds.filter(
      (id: string) => !validItemIds.has(id),
    );

    if (invalidIds.length > 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `존재하지 않거나 조직에 속하지 않는 문항입니다: ${invalidIds.join(", ")}`,
      });
    }

    // 기존 AssignmentItem 삭제
    await tx.assignmentItem.deleteMany({
      where: { assignmentId: input.assignmentId },
    });

    // 새 AssignmentItem 생성
    await tx.assignmentItem.createMany({
      data: input.itemIds.map((itemId, index) => ({
        assignmentId: input.assignmentId,
        itemId,
        position: index,
        ...(input.points?.[index] != null && {
          points: input.points[index],
        }),
      })),
    });

    // 감사 로그 기록 (변경 전/후 데이터)
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "assignments",
        recordId: input.assignmentId,
        action: "update",
        performedBy,
        oldData: {
          itemIds: existing.items.map((i: { itemId: string }) => i.itemId),
          itemCount: existing.items.length,
        } as Prisma.InputJsonValue,
        newData: {
          itemIds: [...input.itemIds],
          itemCount: input.itemIds.length,
        } as Prisma.InputJsonValue,
      },
    });

    // 갱신된 학습지 반환
    const updated = await tx.assignment.findUnique({
      where: { id: input.assignmentId },
      include: ASSIGNMENT_DETAIL_INCLUDE,
    });

    return { assignment: updated };
  });
}

// -------------------------------------------------
// 5. 학습지 공개(발행)
// -------------------------------------------------

/** 학습지를 공개 상태로 전환한다. 공유 링크 URL 반환. */
export async function publishAssignment(
  id: string,
  performedBy: string,
  orgId: string,
) {
  // 기존 학습지 조회 및 소속 확인
  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, orgId: true, isPublished: true, title: true },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  if (existing.isPublished) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 공개된 학습지입니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    const updated = await tx.assignment.update({
      where: { id },
      data: { isPublished: true },
      include: ASSIGNMENT_DETAIL_INCLUDE,
    });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "assignments",
        recordId: id,
        action: "update",
        performedBy,
        oldData: { isPublished: false } as Prisma.InputJsonValue,
        newData: { isPublished: true } as Prisma.InputJsonValue,
      },
    });

    // 결정론적 공유 URL 생성 (assignment ID 기반)
    const shareUrl = buildShareUrl(id);

    return { assignment: updated, shareUrl };
  });
}

// -------------------------------------------------
// 6. 학습지 삭제
// -------------------------------------------------

/** 학습지를 삭제한다. AssignmentItem은 onDelete: Cascade로 자동 삭제. */
export async function deleteAssignment(
  id: string,
  performedBy: string,
  orgId: string,
) {
  // 기존 학습지 조회 및 소속 확인
  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, orgId: true, title: true },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${id}`,
    });
  }

  if (existing.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  return prisma.$transaction(async (tx: TxClient) => {
    // 학습지 삭제 (Cascade로 AssignmentItem 자동 삭제)
    await tx.assignment.delete({ where: { id } });

    // 감사 로그 기록
    await tx.auditLog.create({
      data: {
        orgId,
        tableName: "assignments",
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

// -------------------------------------------------
// 내부 유틸리티
// -------------------------------------------------

/** 학습지 공유 URL 생성 (결정론적, assignment ID 기반) */
function buildShareUrl(assignmentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/assignments/${assignmentId}/share`;
}
