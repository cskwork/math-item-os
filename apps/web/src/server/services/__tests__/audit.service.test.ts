// audit.service 단위 테스트 — Prisma 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const { mockCreate, mockFindMany, mockCount } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@math-item-os/db", () => ({
  prisma: {
    auditLog: {
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

import { createAuditLog, listAuditLogs, getRecordHistory } from "../audit.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// createAuditLog
// ─────────────────────────────────────────────

describe("createAuditLog", () => {
  it("필수 필드로 감사 로그를 생성한다", async () => {
    const fakeLog = { id: "log-1", orgId: "org-1", tableName: "items", recordId: "rec-1", action: "create", performedBy: "user-1" };
    mockCreate.mockResolvedValue(fakeLog);

    const result = await createAuditLog({
      orgId: "org-1",
      tableName: "items",
      recordId: "rec-1",
      action: "create" as const,
      performedBy: "user-1",
    });

    expect(result).toEqual(fakeLog);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        orgId: "org-1",
        tableName: "items",
        recordId: "rec-1",
        action: "create",
        performedBy: "user-1",
        oldData: undefined,
        newData: undefined,
      },
    });
  });

  it("oldData/newData를 포함하여 생성한다", async () => {
    mockCreate.mockResolvedValue({ id: "log-2" });

    await createAuditLog({
      orgId: "org-1",
      tableName: "items",
      recordId: "rec-1",
      action: "update" as const,
      performedBy: "user-1",
      oldData: { status: "draft" },
      newData: { status: "reviewed" },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldData: { status: "draft" },
        newData: { status: "reviewed" },
      }),
    });
  });

  it("oldData/newData가 null이면 undefined로 전달한다", async () => {
    mockCreate.mockResolvedValue({ id: "log-3" });

    await createAuditLog({
      orgId: "org-1",
      tableName: "items",
      recordId: "rec-1",
      action: "delete" as const,
      performedBy: "user-1",
      oldData: null,
      newData: null,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oldData: undefined,
        newData: undefined,
      }),
    });
  });
});

// ─────────────────────────────────────────────
// listAuditLogs
// ─────────────────────────────────────────────

describe("listAuditLogs", () => {
  it("기본 필터(orgId)로 페이지네이션 조회한다", async () => {
    const fakeLogs = [{ id: "log-1" }];
    mockFindMany.mockResolvedValue(fakeLogs);
    mockCount.mockResolvedValue(1);

    const result = await listAuditLogs({ orgId: "org-1", page: 1, limit: 20 });

    expect(result).toEqual({ logs: fakeLogs, total: 1, page: 1, limit: 20 });
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { orgId: "org-1" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
  });

  it("모든 선택적 필터를 적용한다", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const dateFrom = new Date("2026-01-01");
    const dateTo = new Date("2026-12-31");

    await listAuditLogs({
      orgId: "org-1",
      tableName: "items",
      recordId: "rec-1",
      action: "update" as const,
      performedBy: "user-1",
      dateFrom,
      dateTo,
      page: 2,
      limit: 10,
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        tableName: "items",
        recordId: "rec-1",
        action: "update",
        performedBy: "user-1",
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
    });
  });

  it("dateFrom만 있으면 gte만 포함한다", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const dateFrom = new Date("2026-01-01");

    await listAuditLogs({ orgId: "org-1", dateFrom, page: 1, limit: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: dateFrom },
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// getRecordHistory
// ─────────────────────────────────────────────

describe("getRecordHistory", () => {
  it("특정 레코드의 변경 이력을 조회한다", async () => {
    const fakeHistory = [{ id: "log-1" }, { id: "log-2" }];
    mockFindMany.mockResolvedValue(fakeHistory);

    const result = await getRecordHistory("org-1", "rec-1");

    expect(result).toEqual(fakeHistory);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", recordId: "rec-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});
