// misconception.service 단위 테스트 — Prisma 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────
// Prisma 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const {
  mockMisconceptionFindUnique,
  mockMisconceptionFindMany,
  mockMisconceptionCreate,
  mockMisconceptionUpdate,
  mockMisconceptionDelete,
  mockMisconceptionCount,
  mockSkillCount,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockMisconceptionFindUnique: vi.fn(),
  mockMisconceptionFindMany: vi.fn(),
  mockMisconceptionCreate: vi.fn(),
  mockMisconceptionUpdate: vi.fn(),
  mockMisconceptionDelete: vi.fn(),
  mockMisconceptionCount: vi.fn(),
  mockSkillCount: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

// $transaction: 인터랙티브 트랜잭션 패턴 — callback을 tx 객체로 호출
vi.mock("@math-item-os/db", () => ({
  prisma: {
    misconception: {
      findUnique: mockMisconceptionFindUnique,
      findMany: mockMisconceptionFindMany,
      count: mockMisconceptionCount,
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        misconception: {
          findUnique: mockMisconceptionFindUnique,
          create: mockMisconceptionCreate,
          update: mockMisconceptionUpdate,
          delete: mockMisconceptionDelete,
        },
        skill: { count: mockSkillCount },
        auditLog: { create: mockAuditLogCreate },
      }),
    ),
  },
}));

import {
  createMisconception,
  updateMisconception,
  deleteMisconception,
  getMisconceptionById,
  listMisconceptions,
} from "../misconception.service";

beforeEach(() => {
  vi.clearAllMocks();
  // 기본: 트랜잭션 내 findUnique는 null (중복 없음)
  mockMisconceptionFindUnique.mockResolvedValue(null);
  mockSkillCount.mockResolvedValue(0);
});

// ─────────────────────────────────────────────
// createMisconception
// ─────────────────────────────────────────────

describe("createMisconception", () => {
  it("정상적으로 오개념을 생성한다", async () => {
    const created = { id: "m1", code: "MC001", title: "Test", orgId: "org-1", _count: { items: 0 } };
    mockMisconceptionCreate.mockResolvedValue(created);
    mockAuditLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await createMisconception(
      { code: "MC001", title: "Test" },
      "user-1",
      "org-1",
    );

    expect(result).toEqual({ misconception: created });
    expect(mockMisconceptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", code: "MC001", title: "Test" }),
      }),
    );
  });

  it("코드 중복 시 CONFLICT 에러", async () => {
    // 트랜잭션 내 findUnique가 기존 레코드 반환
    mockMisconceptionFindUnique.mockResolvedValue({ id: "existing" });

    try {
      await createMisconception({ code: "MC001", title: "Dup" }, "user-1", "org-1");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("CONFLICT");
    }
  });

  it("relatedSkillIds가 없는 스킬이면 NOT_FOUND 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(null); // 중복 없음
    mockSkillCount.mockResolvedValue(1); // 2개 중 1개만 존재

    await expect(
      createMisconception(
        { code: "MC001", title: "Test", relatedSkillIds: ["s1", "s2"] },
        "user-1",
        "org-1",
      ),
    ).rejects.toThrow(TRPCError);
  });

  it("relatedSkillIds가 모두 존재하면 성공한다", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(null);
    mockSkillCount.mockResolvedValue(2); // 2개 모두 존재
    const created = { id: "m1", code: "MC001", relatedSkills: ["s1", "s2"], _count: { items: 0 } };
    mockMisconceptionCreate.mockResolvedValue(created);
    mockAuditLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await createMisconception(
      { code: "MC001", title: "Test", relatedSkillIds: ["s1", "s2"] },
      "user-1",
      "org-1",
    );

    expect(result.misconception.relatedSkills).toEqual(["s1", "s2"]);
  });
});

// ─────────────────────────────────────────────
// updateMisconception
// ─────────────────────────────────────────────

describe("updateMisconception", () => {
  const existingMisconception = {
    id: "m1",
    orgId: "org-1",
    title: "Old Title",
    typicalError: null,
    remediation: null,
    severity: 1,
    relatedSkills: [],
  };

  it("기존 오개념을 수정한다", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(existingMisconception);
    const updated = { ...existingMisconception, title: "New Title", _count: { items: 0 } };
    mockMisconceptionUpdate.mockResolvedValue(updated);
    mockAuditLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await updateMisconception(
      { id: "m1", title: "New Title" },
      "user-1",
      "org-1",
    );

    expect(result.misconception.title).toBe("New Title");
  });

  it("존재하지 않는 오개념이면 NOT_FOUND 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(null);

    try {
      await updateMisconception({ id: "nonexistent" }, "user-1", "org-1");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  it("다른 조직의 오개념이면 FORBIDDEN 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue({
      ...existingMisconception,
      orgId: "other-org",
    });

    try {
      await updateMisconception({ id: "m1", title: "X" }, "user-1", "org-1");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("relatedSkillIds 검증 후 업데이트한다", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(existingMisconception);
    mockSkillCount.mockResolvedValue(1); // 1개 존재
    const updated = { ...existingMisconception, relatedSkills: ["s1"], _count: { items: 0 } };
    mockMisconceptionUpdate.mockResolvedValue(updated);
    mockAuditLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await updateMisconception(
      { id: "m1", relatedSkillIds: ["s1"] },
      "user-1",
      "org-1",
    );

    expect(result.misconception.relatedSkills).toEqual(["s1"]);
  });
});

// ─────────────────────────────────────────────
// deleteMisconception
// ─────────────────────────────────────────────

describe("deleteMisconception", () => {
  it("오개념을 삭제하고 감사 로그를 기록한다", async () => {
    mockMisconceptionFindUnique.mockResolvedValue({
      id: "m1",
      orgId: "org-1",
      code: "MC001",
      title: "Test",
    });
    mockMisconceptionDelete.mockResolvedValue({ id: "m1" });
    mockAuditLogCreate.mockResolvedValue({ id: "log-1" });

    const result = await deleteMisconception("m1", "user-1", "org-1");
    expect(result).toEqual({ success: true });
  });

  it("존재하지 않는 오개념이면 NOT_FOUND 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(null);

    await expect(
      deleteMisconception("nonexistent", "user-1", "org-1"),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 오개념이면 FORBIDDEN 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue({
      id: "m1",
      orgId: "other-org",
      code: "MC001",
      title: "Test",
    });

    try {
      await deleteMisconception("m1", "user-1", "org-1");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// getMisconceptionById
// ─────────────────────────────────────────────

describe("getMisconceptionById", () => {
  it("ID로 오개념을 조회한다", async () => {
    const misconception = { id: "m1", orgId: "org-1", code: "MC001", _count: { items: 3 } };
    mockMisconceptionFindUnique.mockResolvedValue(misconception);

    const result = await getMisconceptionById("m1", "org-1");
    expect(result).toEqual({ misconception });
  });

  it("존재하지 않으면 NOT_FOUND 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue(null);

    await expect(
      getMisconceptionById("nonexistent", "org-1"),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN 에러", async () => {
    mockMisconceptionFindUnique.mockResolvedValue({
      id: "m1",
      orgId: "other-org",
    });

    try {
      await getMisconceptionById("m1", "org-1");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// listMisconceptions
// ─────────────────────────────────────────────

describe("listMisconceptions", () => {
  it("페이지네이션으로 목록을 조회한다", async () => {
    const fakeMisconceptions = [{ id: "m1" }];
    mockMisconceptionFindMany.mockResolvedValue(fakeMisconceptions);
    mockMisconceptionCount.mockResolvedValue(1);

    const result = await listMisconceptions(
      { page: 1, limit: 20 },
      "org-1",
    );

    expect(result).toEqual({
      misconceptions: fakeMisconceptions,
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("skillId 필터를 적용한다", async () => {
    mockMisconceptionFindMany.mockResolvedValue([]);
    mockMisconceptionCount.mockResolvedValue(0);

    await listMisconceptions(
      { skillId: "s1", page: 1, limit: 10 },
      "org-1",
    );

    expect(mockMisconceptionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          relatedSkills: { has: "s1" },
        }),
      }),
    );
  });

  it("severity 필터를 적용한다", async () => {
    mockMisconceptionFindMany.mockResolvedValue([]);
    mockMisconceptionCount.mockResolvedValue(0);

    await listMisconceptions(
      { severity: 3, page: 1, limit: 10 },
      "org-1",
    );

    expect(mockMisconceptionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          severity: 3,
        }),
      }),
    );
  });

  it("페이지네이션 skip 계산이 올바르다", async () => {
    mockMisconceptionFindMany.mockResolvedValue([]);
    mockMisconceptionCount.mockResolvedValue(0);

    await listMisconceptions({ page: 3, limit: 5 }, "org-1");

    expect(mockMisconceptionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });
});
