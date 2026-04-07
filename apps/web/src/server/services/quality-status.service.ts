// 품질 상태 전이 상태 머신 서비스
// 상태: draft -> reviewed -> approved -> retired
// 역방향: approved -> draft (관리자 전용)
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { AuditAction, QualityStatus, UserRole } from "@math-item-os/db";
import { hasAnyRole } from "../middleware/rbac";

// ─────────────────────────────────────────────────
// 상태 전이 정의
// ─────────────────────────────────────────────────

/** 유효한 상태 전이 맵: 현재 상태 -> 허용되는 다음 상태 목록 */
export const VALID_TRANSITIONS: Readonly<
  Record<QualityStatus, readonly QualityStatus[]>
> = {
  draft: ["reviewed"],
  reviewed: ["approved"],
  approved: ["retired", "draft"],
  retired: [],
} as const;

/** 전이별 허용 역할: "from->to" 형식의 키 */
export const TRANSITION_ROLES: Readonly<
  Record<string, readonly UserRole[]>
> = {
  "draft->reviewed": ["reviewer", "admin"],
  "reviewed->approved": ["reviewer", "admin"],
  "approved->retired": ["admin"],
  "approved->draft": ["admin"],
} as const;

// ─────────────────────────────────────────────────
// 전이 검증
// ─────────────────────────────────────────────────

interface ValidateTransitionInput {
  readonly currentStatus: QualityStatus;
  readonly newStatus: QualityStatus;
  readonly userRole: UserRole;
}

interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

/** 상태 전이 유효성 검증. 전이 가능 여부와 역할 권한을 확인한다. */
export function validateTransition(
  input: ValidateTransitionInput,
): ValidationResult {
  const { currentStatus, newStatus, userRole } = input;

  // 동일 상태로의 전이 차단
  if (currentStatus === newStatus) {
    return {
      valid: false,
      reason: `이미 ${currentStatus} 상태입니다`,
    };
  }

  // 유효한 전이인지 확인
  const allowedStatuses = VALID_TRANSITIONS[currentStatus];
  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      reason: `${currentStatus}에서 ${newStatus}로의 전이는 허용되지 않습니다`,
    };
  }

  // 역할 권한 확인
  const transitionKey = `${currentStatus}->${newStatus}`;
  const allowedRoles = TRANSITION_ROLES[transitionKey];

  if (!allowedRoles) {
    return {
      valid: false,
      reason: `${transitionKey} 전이에 대한 역할 설정이 없습니다`,
    };
  }

  if (!hasAnyRole(userRole, allowedRoles)) {
    return {
      valid: false,
      reason: `${userRole} 역할은 ${transitionKey} 전이 권한이 없습니다. 필요 역할: ${allowedRoles.join(", ")}`,
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────
// 감사 로그 액션 결정
// ─────────────────────────────────────────────────

/** 전이 대상 상태에 따라 적절한 감사 로그 액션을 반환한다. */
function resolveAuditAction(newStatus: QualityStatus): AuditAction {
  switch (newStatus) {
    case "approved":
      return "approve";
    case "retired":
      return "retire";
    default:
      return "update";
  }
}

// ─────────────────────────────────────────────────
// 상태 전이 실행
// ─────────────────────────────────────────────────

interface TransitionStatusInput {
  readonly itemId: string;
  readonly newStatus: QualityStatus;
  readonly userRole: UserRole;
  readonly userId: string;
  readonly orgId: string;
}

/** 문항 품질 상태를 전이하고 감사 로그를 기록한다. */
export async function transitionStatus(input: TransitionStatusInput) {
  const { itemId, newStatus, userRole, userId, orgId } = input;

  // 현재 문항 조회
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, status: true, orgId: true },
  });

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `문항을 찾을 수 없습니다: ${itemId}`,
    });
  }

  // 조직 소속 확인
  if (item.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 문항이 아닙니다",
    });
  }

  // 전이 검증
  const validation = validateTransition({
    currentStatus: item.status,
    newStatus,
    userRole,
  });

  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.reason ?? "상태 전이가 유효하지 않습니다",
    });
  }

  const oldStatus = item.status;

  // 상태 업데이트 + 감사 로그를 트랜잭션으로 처리
  const [updatedItem] = await prisma.$transaction([
    prisma.item.update({
      where: { id: itemId },
      data: { status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        orgId,
        tableName: "items",
        recordId: itemId,
        action: resolveAuditAction(newStatus),
        performedBy: userId,
        oldData: { status: oldStatus },
        newData: { status: newStatus },
      },
    }),
  ]);

  return updatedItem;
}
