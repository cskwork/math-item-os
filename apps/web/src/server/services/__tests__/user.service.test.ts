// user.service 단위 테스트 — Prisma + audit.service 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const {
  mockUserFindMany,
  mockUserCount,
  mockUserFindUniqueOrThrow,
  mockUserUpdate,
  mockCreateAuditLog,
} = vi.hoisted(() => ({
  mockUserFindMany: vi.fn(),
  mockUserCount: vi.fn(),
  mockUserFindUniqueOrThrow: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock("@math-item-os/db", () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      count: mockUserCount,
      findUniqueOrThrow: mockUserFindUniqueOrThrow,
      update: mockUserUpdate,
    },
  },
}));

vi.mock("../audit.service", () => ({
  createAuditLog: mockCreateAuditLog,
}));

import { listUsers, updateUserRole } from "../user.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// listUsers
// ─────────────────────────────────────────────

describe("listUsers", () => {
  const fakeUser = {
    id: "u1",
    name: "Alice",
    email: "alice@test.com",
    role: "teacher",
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("필터 없이 사용자 목록을 조회한다", async () => {
    mockUserFindMany.mockResolvedValue([fakeUser]);
    mockUserCount.mockResolvedValue(1);

    const result = await listUsers({ page: 1, limit: 20 });

    expect(result).toEqual({ users: [fakeUser], total: 1 });
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 20,
      }),
    );
  });

  it("역할 필터를 적용한다", async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(0);

    await listUsers({ role: "admin", page: 2, limit: 10 });

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "admin" },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("페이지네이션 skip 계산이 올바르다", async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(0);

    await listUsers({ page: 3, limit: 5 });

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });
});

// ─────────────────────────────────────────────
// updateUserRole
// ─────────────────────────────────────────────

describe("updateUserRole", () => {
  const updatedUser = {
    id: "u1",
    name: "Alice",
    email: "alice@test.com",
    role: "admin",
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("역할을 변경하고 감사 로그를 기록한다", async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({ role: "teacher" });
    mockUserUpdate.mockResolvedValue(updatedUser);
    mockCreateAuditLog.mockResolvedValue({ id: "log-1" });

    const result = await updateUserRole("u1", "admin", "performer-1", "org-1");

    expect(result).toEqual(updatedUser);
    expect(mockUserFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: true },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { role: "admin" },
      select: expect.objectContaining({
        id: true,
        name: true,
        email: true,
        role: true,
      }),
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      orgId: "org-1",
      tableName: "users",
      recordId: "u1",
      action: "update",
      performedBy: "performer-1",
      oldData: { role: "teacher" },
      newData: { role: "admin" },
    });
  });

  it("사용자가 없으면 예외를 전파한다", async () => {
    mockUserFindUniqueOrThrow.mockRejectedValue(new Error("Record not found"));

    await expect(
      updateUserRole("nonexistent", "admin", "performer-1", "org-1"),
    ).rejects.toThrow("Record not found");
  });
});
