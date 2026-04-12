// quality-status.service 단위 테스트 — 상태 전이 검증 + transitionStatus
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────
// 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const { mockItemFindUnique, mockItemUpdate, mockAuditLogCreate, mockTransaction } =
  vi.hoisted(() => ({
    mockItemFindUnique: vi.fn(),
    mockItemUpdate: vi.fn(),
    mockAuditLogCreate: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("@math-item-os/db", () => ({
  prisma: {
    item: {
      findUnique: mockItemFindUnique,
      update: mockItemUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("../../middleware/rbac", () => ({
  hasAnyRole: vi.fn((userRole: string, allowedRoles: readonly string[]) =>
    allowedRoles.includes(userRole),
  ),
}));

import {
  validateTransition,
  transitionStatus,
  VALID_TRANSITIONS,
  TRANSITION_ROLES,
} from "../quality-status.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// VALID_TRANSITIONS 상수
// ─────────────────────────────────────────────

describe("VALID_TRANSITIONS", () => {
  it("draft -> reviewed만 허용", () => {
    expect(VALID_TRANSITIONS.draft).toEqual(["reviewed"]);
  });

  it("reviewed -> approved만 허용", () => {
    expect(VALID_TRANSITIONS.reviewed).toEqual(["approved"]);
  });

  it("approved -> retired, draft 허용", () => {
    expect(VALID_TRANSITIONS.approved).toEqual(["retired", "draft"]);
  });

  it("retired는 전이 불가", () => {
    expect(VALID_TRANSITIONS.retired).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// validateTransition
// ─────────────────────────────────────────────

describe("validateTransition", () => {
  it("유효한 전이: draft -> reviewed (reviewer)", () => {
    const result = validateTransition({
      currentStatus: "draft",
      newStatus: "reviewed",
      userRole: "reviewer",
    });
    expect(result).toEqual({ valid: true });
  });

  it("유효한 전이: reviewed -> approved (admin)", () => {
    const result = validateTransition({
      currentStatus: "reviewed",
      newStatus: "approved",
      userRole: "admin",
    });
    expect(result).toEqual({ valid: true });
  });

  it("유효한 전이: approved -> draft (admin)", () => {
    const result = validateTransition({
      currentStatus: "approved",
      newStatus: "draft",
      userRole: "admin",
    });
    expect(result).toEqual({ valid: true });
  });

  it("유효한 전이: approved -> retired (admin)", () => {
    const result = validateTransition({
      currentStatus: "approved",
      newStatus: "retired",
      userRole: "admin",
    });
    expect(result).toEqual({ valid: true });
  });

  it("동일 상태 전이를 차단한다", () => {
    const result = validateTransition({
      currentStatus: "draft",
      newStatus: "draft",
      userRole: "admin",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("이미");
  });

  it("허용되지 않는 전이를 차단한다 (draft -> approved)", () => {
    const result = validateTransition({
      currentStatus: "draft",
      newStatus: "approved",
      userRole: "admin",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("허용되지 않습니다");
  });

  it("retired에서는 아무 전이도 불가", () => {
    const result = validateTransition({
      currentStatus: "retired",
      newStatus: "draft",
      userRole: "admin",
    });
    expect(result.valid).toBe(false);
  });

  it("역할 권한이 없으면 차단한다 (teacher -> draft->reviewed)", () => {
    const result = validateTransition({
      currentStatus: "draft",
      newStatus: "reviewed",
      userRole: "teacher",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("권한이 없습니다");
  });
});

// ─────────────────────────────────────────────
// transitionStatus
// ─────────────────────────────────────────────

describe("transitionStatus", () => {
  it("문항이 없으면 NOT_FOUND 에러", async () => {
    mockItemFindUnique.mockResolvedValue(null);

    try {
      await transitionStatus({
        itemId: "item-1",
        newStatus: "reviewed",
        userRole: "reviewer",
        userId: "user-1",
        orgId: "org-1",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  it("다른 조직의 문항이면 FORBIDDEN 에러", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      status: "draft",
      orgId: "other-org",
    });

    try {
      await transitionStatus({
        itemId: "item-1",
        newStatus: "reviewed",
        userRole: "reviewer",
        userId: "user-1",
        orgId: "org-1",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("유효하지 않은 전이면 BAD_REQUEST 에러", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      status: "draft",
      orgId: "org-1",
    });

    try {
      await transitionStatus({
        itemId: "item-1",
        newStatus: "approved",
        userRole: "admin",
        userId: "user-1",
        orgId: "org-1",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("유효한 전이 시 트랜잭션으로 상태를 업데이트한다", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      status: "draft",
      orgId: "org-1",
    });
    const updatedItem = { id: "item-1", status: "reviewed" };
    mockTransaction.mockResolvedValue([updatedItem, {}]);

    const result = await transitionStatus({
      itemId: "item-1",
      newStatus: "reviewed",
      userRole: "reviewer",
      userId: "user-1",
      orgId: "org-1",
    });

    expect(result).toEqual(updatedItem);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("approved 전이 시 트랜잭션을 호출한다", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      status: "reviewed",
      orgId: "org-1",
    });
    mockTransaction.mockResolvedValue([{ id: "item-1", status: "approved" }, {}]);

    await transitionStatus({
      itemId: "item-1",
      newStatus: "approved",
      userRole: "admin",
      userId: "user-1",
      orgId: "org-1",
    });

    // 트랜잭션에 전달되는 배열은 [item.update, auditLog.create]
    const txArgs = mockTransaction.mock.calls[0]![0];
    expect(txArgs).toHaveLength(2);
  });
});

describe("TRANSITION_ROLES", () => {
  it("draft->reviewed는 reviewer, admin 허용", () => {
    expect(TRANSITION_ROLES["draft->reviewed"]).toEqual(["reviewer", "admin"]);
  });

  it("approved->retired는 admin만 허용", () => {
    expect(TRANSITION_ROLES["approved->retired"]).toEqual(["admin"]);
  });

  it("approved->draft는 admin만 허용", () => {
    expect(TRANSITION_ROLES["approved->draft"]).toEqual(["admin"]);
  });
});
