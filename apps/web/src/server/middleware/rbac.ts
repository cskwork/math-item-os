// RBAC 미들웨어 - 역할 기반 접근 제어
import { TRPCError } from "@trpc/server";
import type { UserRole } from "@math-item-os/db";

// 역할 계층: admin > reviewer > teacher
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  reviewer: 2,
  teacher: 1,
};

/** 사용자 역할이 최소 요구 역할 이상인지 확인 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/** 사용자 역할이 허용 목록에 포함되는지 확인 */
export function hasAnyRole(
  userRole: UserRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return allowedRoles.includes(userRole);
}

/** 역할 검증 실패 시 TRPCError 발생 */
export function requireRole(
  userRole: UserRole | undefined,
  allowedRoles: readonly UserRole[],
): asserts userRole is UserRole {
  if (!userRole) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "인증이 필요합니다",
    });
  }
  if (!hasAnyRole(userRole, allowedRoles)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `권한이 부족합니다. 필요 역할: ${allowedRoles.join(", ")}`,
    });
  }
}

/** 최소 역할 검증 */
export function requireMinRole(
  userRole: UserRole | undefined,
  minRole: UserRole,
): asserts userRole is UserRole {
  if (!userRole) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "인증이 필요합니다",
    });
  }
  if (!hasMinRole(userRole, minRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `최소 ${minRole} 역할이 필요합니다`,
    });
  }
}
