// skill.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

const mockTx = {
  skill: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("@math-item-os/db", () => ({
  prisma: {
    skill: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillById,
  listSkills,
  getSkillItems,
} from "../skill.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const ORG_ID = "org-1";
const USER_ID = "user-1";

const mockSkill = {
  id: "sk-1",
  orgId: ORG_ID,
  code: "ALG-001",
  title: "일차방정식",
  description: "일차방정식 풀기",
  topicPath: "math.algebra.linear",
  bloomLevel: 3,
  estimatedTimeMin: 5,
  typeLevel: 2,
  _count: { items: 10 },
  prerequisitesFrom: [],
  prerequisitesTo: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// createSkill
// ─────────────────────────────────────────────

describe("createSkill", () => {
  it("새 스킬을 생성하고 감사 로그를 기록한다", async () => {
    mockTx.skill.findUnique.mockResolvedValue(null);
    mockTx.skill.create.mockResolvedValue(mockSkill);

    const result = await createSkill(
      {
        code: "ALG-001",
        title: "일차방정식",
        topicPath: "math.algebra.linear",
        bloomLevel: 3,
      },
      USER_ID,
      ORG_ID,
    );

    expect(result.skill).toEqual(mockSkill);
    expect(mockTx.skill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ORG_ID, code: "ALG-001" }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "create" }),
      }),
    );
  });

  it("코드 중복 시 CONFLICT를 throw한다", async () => {
    mockTx.skill.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      createSkill(
        { code: "ALG-001", title: "중복", topicPath: "math" },
        USER_ID,
        ORG_ID,
      ),
    ).rejects.toThrow(TRPCError);

    try {
      await createSkill(
        { code: "ALG-001", title: "중복", topicPath: "math" },
        USER_ID,
        ORG_ID,
      );
    } catch (e) {
      expect((e as TRPCError).code).toBe("CONFLICT");
      expect((e as TRPCError).message).toBe("DUPLICATE_CODE");
    }
  });
});

// ─────────────────────────────────────────────
// updateSkill
// ─────────────────────────────────────────────

describe("updateSkill", () => {
  it("기존 스킬을 수정하고 감사 로그를 기록한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    mockTx.skill.update.mockResolvedValue({ ...mockSkill, title: "수정됨" });

    const result = await updateSkill(
      { id: "sk-1", title: "수정됨" },
      USER_ID,
      ORG_ID,
    );

    expect(result.skill.title).toBe("수정됨");
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "update" }),
      }),
    );
  });

  it("스킬을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null);

    await expect(
      updateSkill({ id: "bad-id" }, USER_ID, ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 스킬이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...mockSkill,
      orgId: "other-org",
    } as never);

    try {
      await updateSkill({ id: "sk-1" }, USER_ID, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("여러 필드를 동시에 업데이트한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    mockTx.skill.update.mockResolvedValue({
      ...mockSkill,
      title: "updated",
      bloomLevel: 5,
      typeLevel: 3,
    });

    await updateSkill(
      { id: "sk-1", title: "updated", bloomLevel: 5, typeLevel: 3 },
      USER_ID,
      ORG_ID,
    );

    expect(mockTx.skill.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "updated",
          bloomLevel: 5,
          typeLevel: 3,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// deleteSkill
// ─────────────────────────────────────────────

describe("deleteSkill", () => {
  it("스킬을 삭제하고 감사 로그를 기록한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    mockTx.skill.delete.mockResolvedValue({});

    const result = await deleteSkill("sk-1", USER_ID, ORG_ID);

    expect(result.success).toBe(true);
    expect(mockTx.skill.delete).toHaveBeenCalledWith({ where: { id: "sk-1" } });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "delete" }),
      }),
    );
  });

  it("스킬을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null);

    await expect(deleteSkill("bad-id", USER_ID, ORG_ID)).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 스킬이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...mockSkill,
      orgId: "other-org",
    } as never);

    try {
      await deleteSkill("sk-1", USER_ID, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// getSkillById
// ─────────────────────────────────────────────

describe("getSkillById", () => {
  it("ID로 스킬을 반환한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);

    const result = await getSkillById("sk-1", ORG_ID);

    expect(result.skill).toEqual(mockSkill);
  });

  it("스킬을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null);

    await expect(getSkillById("bad-id", ORG_ID)).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 스킬이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...mockSkill,
      orgId: "other-org",
    } as never);

    try {
      await getSkillById("sk-1", ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// listSkills
// ─────────────────────────────────────────────

describe("listSkills", () => {
  it("기본 목록을 반환한다", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([mockSkill] as never);
    vi.mocked(prisma.skill.count).mockResolvedValue(1);

    const result = await listSkills({ page: 1, limit: 20 }, ORG_ID);

    expect(result.skills).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("topicPath 접두사 필터를 적용한다", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.skill.count).mockResolvedValue(0);

    await listSkills({ topicPath: "math.algebra", page: 1, limit: 20 }, ORG_ID);

    expect(prisma.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          topicPath: { startsWith: "math.algebra" },
        }),
      }),
    );
  });

  it("bloomLevel 필터를 적용한다", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.skill.count).mockResolvedValue(0);

    await listSkills({ bloomLevel: 3, page: 1, limit: 20 }, ORG_ID);

    expect(prisma.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bloomLevel: 3 }),
      }),
    );
  });

  it("typeLevel 필터를 적용한다", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.skill.count).mockResolvedValue(0);

    await listSkills({ typeLevel: 2, page: 1, limit: 20 }, ORG_ID);

    expect(prisma.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ typeLevel: 2 }),
      }),
    );
  });

  it("페이지네이션이 올바르게 동작한다", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.skill.count).mockResolvedValue(0);

    await listSkills({ page: 3, limit: 10 }, ORG_ID);

    expect(prisma.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

// ─────────────────────────────────────────────
// getSkillItems
// ─────────────────────────────────────────────

describe("getSkillItems", () => {
  it("스킬에 연결된 문항 목록을 반환한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([{ id: "item-1" }] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await getSkillItems(
      { skillId: "sk-1", page: 1, limit: 20 },
      ORG_ID,
    );

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("스킬을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null);

    await expect(
      getSkillItems({ skillId: "bad-id", page: 1, limit: 20 }, ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 스킬이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...mockSkill,
      orgId: "other-org",
    } as never);

    try {
      await getSkillItems({ skillId: "sk-1", page: 1, limit: 20 }, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("difficultyAuthor 정렬을 지원한다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(0);

    await getSkillItems(
      { skillId: "sk-1", page: 1, limit: 20, sortBy: "difficultyAuthor" },
      ORG_ID,
    );

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { difficultyAuthor: "desc" },
      }),
    );
  });

  it("기본 정렬은 createdAt이다", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(mockSkill as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(0);

    await getSkillItems(
      { skillId: "sk-1", page: 1, limit: 20 },
      ORG_ID,
    );

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
