// 감사 로그 서비스 - 불변 INSERT 전용, UPDATE/DELETE 차단
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import type { AuditAction } from "@math-item-os/db";

interface CreateAuditLogInput {
  orgId: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  performedBy: string;
  oldData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
}

/** 감사 로그 기록 (INSERT 전용) */
export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      tableName: input.tableName,
      recordId: input.recordId,
      action: input.action,
      performedBy: input.performedBy,
      oldData: input.oldData ?? undefined,
      newData: input.newData ?? undefined,
    },
  });
}

/** 감사 로그 목록 조회 (필터 + 페이지네이션) */
export async function listAuditLogs(params: {
  orgId: string;
  tableName?: string;
  recordId?: string;
  action?: AuditAction;
  performedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}) {
  const where = {
    orgId: params.orgId,
    ...(params.tableName && { tableName: params.tableName }),
    ...(params.recordId && { recordId: params.recordId }),
    ...(params.action && { action: params.action }),
    ...(params.performedBy && { performedBy: params.performedBy }),
    ...((params.dateFrom || params.dateTo) && {
      createdAt: {
        ...(params.dateFrom && { gte: params.dateFrom }),
        ...(params.dateTo && { lte: params.dateTo }),
      },
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page: params.page, limit: params.limit };
}

/** 특정 레코드의 변경 이력 조회 */
export async function getRecordHistory(orgId: string, recordId: string) {
  return prisma.auditLog.findMany({
    where: { orgId, recordId },
    orderBy: { createdAt: "desc" },
  });
}
