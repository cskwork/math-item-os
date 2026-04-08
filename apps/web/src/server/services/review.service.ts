// 검수 작업 큐 서비스 - 문항 상태 기반 검수 작업 파생
// ReviewTask는 별도 테이블 없이 Item 상태에서 파생되는 가상 엔티티 (MVP)
import { prisma } from "@math-item-os/db";
import type { QualityStatus } from "@math-item-os/db";
import { createAuditLog } from "./audit.service";

interface ReviewTaskResult {
  readonly id: string;
  readonly itemId: string;
  readonly itemTitle: string;
  readonly taskType: string;
  readonly status: string;
  readonly assigneeId: string | null;
  readonly priority: number;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly isGenerated: boolean;
  readonly createdAt: Date;
}

interface ListReviewTasksInput {
  readonly orgId: string;
  readonly taskType?: string;
  readonly status?: string;
  readonly assigneeId?: string;
  readonly priority?: number;
  readonly page: number;
  readonly limit: number;
}

/** 문항 상태에서 검수 작업 유형 파생 */
function deriveTaskType(item: {
  isGenerated: boolean;
  skills: { id: string }[];
}): string {
  if (item.isGenerated) return "generation_review";
  if (item.skills.length === 0) return "tag_review";
  return "tag_review";
}

/** 문항 상태를 검수 작업 상태로 매핑 */
function deriveReviewStatus(itemStatus: string): string {
  switch (itemStatus) {
    case "draft":
      return "pending";
    case "reviewed":
      return "in_progress";
    case "approved":
      return "completed";
    case "retired":
      return "rejected";
    default:
      return "pending";
  }
}

/** 난이도 기반 우선순위 계산 (역순: 쉬운 문항 우선 검수) */
function derivePriority(difficulty: number | null): number {
  if (difficulty === null) return 3;
  return Math.max(1, Math.min(5, 6 - difficulty));
}

/** 검수 작업 목록 조회 */
export async function listReviewTasks(
  input: ListReviewTasksInput,
): Promise<{ tasks: readonly ReviewTaskResult[]; total: number }> {
  // 검수 대상: draft 또는 reviewed 상태 문항 (기본)
  const statusFilter: QualityStatus[] = [];
  if (!input.status || input.status === "pending") statusFilter.push("draft");
  if (!input.status || input.status === "in_progress")
    statusFilter.push("reviewed");
  if (input.status === "completed") statusFilter.push("approved");
  if (input.status === "rejected") statusFilter.push("retired");

  const where = {
    orgId: input.orgId,
    status: { in: statusFilter },
    ...(input.taskType === "generation_review" && { isGenerated: true }),
    ...(input.taskType === "tag_review" && { isGenerated: false }),
  };

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { skills: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.item.count({ where }),
  ]);

  const tasks: ReviewTaskResult[] = items.map((item) => ({
    id: item.id,
    itemId: item.id,
    itemTitle: item.bodyLatex.substring(0, 80),
    taskType: deriveTaskType(item),
    status: deriveReviewStatus(item.status),
    assigneeId: item.createdBy,
    priority: derivePriority(item.difficultyAuthor),
    schoolLevel: item.schoolLevel,
    grade: item.grade,
    isGenerated: item.isGenerated,
    createdAt: item.createdAt,
  }));

  // 우선순위 필터 적용 (후처리)
  const filtered =
    input.priority !== undefined
      ? tasks.filter((t) => t.priority === input.priority)
      : tasks;

  return { tasks: filtered, total };
}

/** 검수 작업 상태 업데이트 (= 문항 품질 상태 전이) */
export async function updateReviewTask(
  taskId: string,
  status: string,
  comment: string | undefined,
  performedBy: string,
  orgId: string,
): Promise<ReviewTaskResult> {
  // 검수 상태 -> 문항 상태 역매핑
  let newItemStatus: QualityStatus;
  switch (status) {
    case "in_progress":
      newItemStatus = "reviewed";
      break;
    case "completed":
      newItemStatus = "approved";
      break;
    case "rejected":
      newItemStatus = "retired";
      break;
    default:
      newItemStatus = "draft";
  }

  const item = await prisma.item.update({
    where: { id: taskId },
    data: { status: newItemStatus },
    include: { skills: { select: { id: true } } },
  });

  // 감사 로그 기록
  await createAuditLog({
    orgId,
    tableName: "items",
    recordId: taskId,
    action: newItemStatus === "approved" ? "approve" : "update",
    performedBy,
    newData: { status: newItemStatus, reviewComment: comment ?? null },
  });

  return {
    id: item.id,
    itemId: item.id,
    itemTitle: item.bodyLatex.substring(0, 80),
    taskType: deriveTaskType(item),
    status: deriveReviewStatus(item.status),
    assigneeId: item.createdBy,
    priority: derivePriority(item.difficultyAuthor),
    schoolLevel: item.schoolLevel,
    grade: item.grade,
    isGenerated: item.isGenerated,
    createdAt: item.createdAt,
  };
}
