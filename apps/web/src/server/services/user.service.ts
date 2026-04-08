// 사용자 관리 서비스 - 목록 조회 및 역할 변경
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";
import { createAuditLog } from "./audit.service";

interface UserResult {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: string;
  readonly image: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ListUsersInput {
  readonly role?: string;
  readonly page: number;
  readonly limit: number;
}

/** 사용자 목록 조회 */
export async function listUsers(
  input: ListUsersInput,
): Promise<{ users: readonly UserResult[]; total: number }> {
  const where = {
    ...(input.role && { role: input.role as UserRole }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/** 사용자 역할 변경 */
export async function updateUserRole(
  userId: string,
  role: string,
  performedBy: string,
  orgId: string,
): Promise<UserResult> {
  const oldUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: role as UserRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 감사 로그 기록
  await createAuditLog({
    orgId,
    tableName: "users",
    recordId: userId,
    action: "update",
    performedBy,
    oldData: { role: oldUser.role },
    newData: { role },
  });

  return user;
}
