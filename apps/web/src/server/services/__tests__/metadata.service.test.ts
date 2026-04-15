// metadata.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

vi.mock("@math-item-os/db", () => ({
  prisma: {
    item: {
      findUnique: vi.fn(),
    },
    skill: {
      findMany: vi.fn(),
    },
    standard: {
      findMany: vi.fn(),
    },
    misconception: {
      findMany: vi.fn(),
    },
    itemSkill: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    itemStandard: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    itemMisconception: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  linkSkillsToItem,
  updateItemSkills,
  getItemSkills,
  linkStandardsToItem,
  updateItemStandards,
  getItemStandards,
  linkMisconceptionsToItem,
  updateItemMisconceptions,
  getItemMisconceptions,
  findSkillsByTopicPath,
  findStandardsByTopicPath,
  calculateMetadataCompleteness,
} from "../metadata.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const ORG_ID = "org-1";
const ITEM_ID = "item-1";

function mockItemOwnership(orgId: string = ORG_ID) {
  vi.mocked(prisma.item.findUnique).mockResolvedValue({
    id: ITEM_ID,
    orgId,
  } as never);
}

function mockSkillValidation(foundIds: string[]) {
  vi.mocked(prisma.skill.findMany).mockResolvedValue(
    foundIds.map((id) => ({ id })) as never,
  );
}

function mockStandardValidation(foundIds: string[]) {
  vi.mocked(prisma.standard.findMany).mockResolvedValue(
    foundIds.map((id) => ({ id })) as never,
  );
}

function mockMisconceptionValidation(foundIds: string[]) {
  vi.mocked(prisma.misconception.findMany).mockResolvedValue(
    foundIds.map((id) => ({ id })) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// linkSkillsToItem
// ─────────────────────────────────────────────

describe("linkSkillsToItem", () => {
  it("문항에 스킬을 연결한다 (첫 번째가 primary)", async () => {
    mockItemOwnership();
    mockSkillValidation(["sk-1", "sk-2"]);

    await linkSkillsToItem(ITEM_ID, ["sk-1", "sk-2"], ORG_ID);

    expect(prisma.itemSkill.createMany).toHaveBeenCalledWith({
      data: [
        { itemId: ITEM_ID, skillId: "sk-1", isPrimary: true },
        { itemId: ITEM_ID, skillId: "sk-2", isPrimary: false },
      ],
    });
  });

  it("빈 skillIds이면 연결하지 않는다", async () => {
    mockItemOwnership();

    await linkSkillsToItem(ITEM_ID, [], ORG_ID);

    expect(prisma.itemSkill.createMany).not.toHaveBeenCalled();
  });

  it("문항을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    await expect(linkSkillsToItem(ITEM_ID, ["sk-1"], ORG_ID)).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 문항이면 FORBIDDEN을 throw한다", async () => {
    mockItemOwnership("other-org");

    try {
      await linkSkillsToItem(ITEM_ID, ["sk-1"], ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("존재하지 않는 스킬이면 NOT_FOUND를 throw한다", async () => {
    mockItemOwnership();
    mockSkillValidation(["sk-1"]); // sk-2가 없음

    await expect(
      linkSkillsToItem(ITEM_ID, ["sk-1", "sk-2"], ORG_ID),
    ).rejects.toThrow(TRPCError);
  });
});

// ─────────────────────────────────────────────
// updateItemSkills
// ─────────────────────────────────────────────

describe("updateItemSkills", () => {
  it("기존 스킬을 삭제하고 새로 연결한다", async () => {
    mockItemOwnership();
    mockSkillValidation(["sk-3"]);

    await updateItemSkills(ITEM_ID, ["sk-3"], ORG_ID);

    expect(prisma.itemSkill.deleteMany).toHaveBeenCalledWith({
      where: { itemId: ITEM_ID },
    });
    expect(prisma.itemSkill.createMany).toHaveBeenCalledWith({
      data: [{ itemId: ITEM_ID, skillId: "sk-3", isPrimary: true }],
    });
  });

  it("빈 배열이면 삭제만 수행한다", async () => {
    mockItemOwnership();

    await updateItemSkills(ITEM_ID, [], ORG_ID);

    expect(prisma.itemSkill.deleteMany).toHaveBeenCalled();
    expect(prisma.itemSkill.createMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// getItemSkills
// ─────────────────────────────────────────────

describe("getItemSkills", () => {
  it("연결된 스킬 목록을 반환한다", async () => {
    mockItemOwnership();
    vi.mocked(prisma.itemSkill.findMany).mockResolvedValue([
      {
        isPrimary: true,
        skill: { id: "sk-1", code: "ALG-001", title: "일차방정식", topicPath: "math.algebra", bloomLevel: 3 },
      },
    ] as never);

    const result = await getItemSkills(ITEM_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].isPrimary).toBe(true);
    expect(result[0].code).toBe("ALG-001");
  });
});

// ─────────────────────────────────────────────
// linkStandardsToItem
// ─────────────────────────────────────────────

describe("linkStandardsToItem", () => {
  it("문항에 성취기준을 연결한다", async () => {
    mockItemOwnership();
    mockStandardValidation(["std-1"]);

    await linkStandardsToItem(ITEM_ID, ["std-1"], ORG_ID);

    expect(prisma.itemStandard.createMany).toHaveBeenCalledWith({
      data: [{ itemId: ITEM_ID, standardId: "std-1" }],
    });
  });

  it("빈 배열이면 연결하지 않는다", async () => {
    mockItemOwnership();

    await linkStandardsToItem(ITEM_ID, [], ORG_ID);

    expect(prisma.itemStandard.createMany).not.toHaveBeenCalled();
  });

  it("존재하지 않는 성취기준이면 NOT_FOUND를 throw한다", async () => {
    mockItemOwnership();
    mockStandardValidation([]); // 아무것도 못 찾음

    await expect(
      linkStandardsToItem(ITEM_ID, ["std-bad"], ORG_ID),
    ).rejects.toThrow(TRPCError);
  });
});

// ─────────────────────────────────────────────
// updateItemStandards
// ─────────────────────────────────────────────

describe("updateItemStandards", () => {
  it("기존 성취기준을 삭제하고 새로 연결한다", async () => {
    mockItemOwnership();
    mockStandardValidation(["std-2"]);

    await updateItemStandards(ITEM_ID, ["std-2"], ORG_ID);

    expect(prisma.itemStandard.deleteMany).toHaveBeenCalled();
    expect(prisma.itemStandard.createMany).toHaveBeenCalled();
  });

  it("빈 배열이면 삭제만 수행한다", async () => {
    mockItemOwnership();

    await updateItemStandards(ITEM_ID, [], ORG_ID);

    expect(prisma.itemStandard.deleteMany).toHaveBeenCalled();
    expect(prisma.itemStandard.createMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// getItemStandards
// ─────────────────────────────────────────────

describe("getItemStandards", () => {
  it("연결된 성취기준 목록을 반환한다", async () => {
    mockItemOwnership();
    vi.mocked(prisma.itemStandard.findMany).mockResolvedValue([
      { standard: { id: "std-1", code: "M7-01", title: "수와 연산" } },
    ] as never);

    const result = await getItemStandards(ITEM_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "std-1", code: "M7-01", title: "수와 연산" });
  });
});

// ─────────────────────────────────────────────
// linkMisconceptionsToItem
// ─────────────────────────────────────────────

describe("linkMisconceptionsToItem", () => {
  it("문항에 오개념을 연결한다", async () => {
    mockItemOwnership();
    mockMisconceptionValidation(["mc-1"]);

    await linkMisconceptionsToItem(ITEM_ID, ["mc-1"], ORG_ID);

    expect(prisma.itemMisconception.createMany).toHaveBeenCalledWith({
      data: [{ itemId: ITEM_ID, misconceptionId: "mc-1" }],
    });
  });

  it("빈 배열이면 연결하지 않는다", async () => {
    mockItemOwnership();

    await linkMisconceptionsToItem(ITEM_ID, [], ORG_ID);

    expect(prisma.itemMisconception.createMany).not.toHaveBeenCalled();
  });

  it("존재하지 않는 오개념이면 NOT_FOUND를 throw한다", async () => {
    mockItemOwnership();
    mockMisconceptionValidation([]);

    await expect(
      linkMisconceptionsToItem(ITEM_ID, ["mc-bad"], ORG_ID),
    ).rejects.toThrow(TRPCError);
  });
});

// ─────────────────────────────────────────────
// updateItemMisconceptions
// ─────────────────────────────────────────────

describe("updateItemMisconceptions", () => {
  it("기존 오개념을 삭제하고 새로 연결한다", async () => {
    mockItemOwnership();
    mockMisconceptionValidation(["mc-2"]);

    await updateItemMisconceptions(ITEM_ID, ["mc-2"], ORG_ID);

    expect(prisma.itemMisconception.deleteMany).toHaveBeenCalled();
    expect(prisma.itemMisconception.createMany).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// getItemMisconceptions
// ─────────────────────────────────────────────

describe("getItemMisconceptions", () => {
  it("연결된 오개념 목록을 반환한다", async () => {
    mockItemOwnership();
    vi.mocked(prisma.itemMisconception.findMany).mockResolvedValue([
      { misconception: { id: "mc-1", code: "MC-001", title: "등호 오해" } },
    ] as never);

    const result = await getItemMisconceptions(ITEM_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "mc-1", code: "MC-001", title: "등호 오해" });
  });
});

// ─────────────────────────────────────────────
// findSkillsByTopicPath
// ─────────────────────────────────────────────

describe("findSkillsByTopicPath", () => {
  it("ltree 경로로 스킬을 검색한다", async () => {
    const skills = [
      { id: "sk-1", code: "ALG-001", title: "일차방정식", topicPath: "math.algebra.linear", bloomLevel: 3 },
    ];
    vi.mocked(prisma.$queryRaw).mockResolvedValue(skills as never);

    const result = await findSkillsByTopicPath("math.algebra", ORG_ID);

    expect(result).toEqual(skills);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// findStandardsByTopicPath
// ─────────────────────────────────────────────

describe("findStandardsByTopicPath", () => {
  it("ltree 경로로 성취기준을 검색한다", async () => {
    const standards = [
      { id: "std-1", code: "M7-01", title: "수와 연산", schoolLevel: "middle", grade: 7, topicPath: "math.number" },
    ];
    vi.mocked(prisma.$queryRaw).mockResolvedValue(standards as never);

    const result = await findStandardsByTopicPath("math.number", ORG_ID);

    expect(result).toEqual(standards);
  });
});

// ─────────────────────────────────────────────
// calculateMetadataCompleteness
// ─────────────────────────────────────────────

describe("calculateMetadataCompleteness", () => {
  it("모든 메타데이터가 있으면 score=1.0을 반환한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: ITEM_ID,
      orgId: ORG_ID,
      difficultyAuthor: 3,
      topicPath: "math.algebra",
    } as never);
    vi.mocked(prisma.itemSkill.count).mockResolvedValue(2);
    vi.mocked(prisma.itemStandard.count).mockResolvedValue(1);
    vi.mocked(prisma.itemMisconception.count).mockResolvedValue(1);

    const result = await calculateMetadataCompleteness(ITEM_ID, ORG_ID);

    expect(result.score).toBe(1);
    expect(result.hasSkills).toBe(true);
    expect(result.hasStandards).toBe(true);
    expect(result.hasMisconceptions).toBe(true);
    expect(result.hasDifficulty).toBe(true);
    expect(result.hasTopicPath).toBe(true);
  });

  it("메타데이터가 전혀 없으면 score=0을 반환한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: ITEM_ID,
      orgId: ORG_ID,
      difficultyAuthor: null,
      topicPath: null,
    } as never);
    vi.mocked(prisma.itemSkill.count).mockResolvedValue(0);
    vi.mocked(prisma.itemStandard.count).mockResolvedValue(0);
    vi.mocked(prisma.itemMisconception.count).mockResolvedValue(0);

    const result = await calculateMetadataCompleteness(ITEM_ID, ORG_ID);

    expect(result.score).toBe(0);
    expect(result.hasSkills).toBe(false);
    expect(result.hasStandards).toBe(false);
  });

  it("일부 메타데이터만 있으면 가중 점수를 반환한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: ITEM_ID,
      orgId: ORG_ID,
      difficultyAuthor: 3,
      topicPath: null,
    } as never);
    vi.mocked(prisma.itemSkill.count).mockResolvedValue(1);
    vi.mocked(prisma.itemStandard.count).mockResolvedValue(0);
    vi.mocked(prisma.itemMisconception.count).mockResolvedValue(0);

    const result = await calculateMetadataCompleteness(ITEM_ID, ORG_ID);

    // skills(0.3) + difficulty(0.15) = 0.45
    expect(result.score).toBeCloseTo(0.45);
    expect(result.hasSkills).toBe(true);
    expect(result.hasDifficulty).toBe(true);
    expect(result.hasStandards).toBe(false);
  });

  it("문항을 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.itemSkill.count).mockResolvedValue(0);
    vi.mocked(prisma.itemStandard.count).mockResolvedValue(0);
    vi.mocked(prisma.itemMisconception.count).mockResolvedValue(0);

    await expect(
      calculateMetadataCompleteness("bad-id", ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 문항이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: ITEM_ID,
      orgId: "other-org",
      difficultyAuthor: null,
      topicPath: null,
    } as never);
    vi.mocked(prisma.itemSkill.count).mockResolvedValue(0);
    vi.mocked(prisma.itemStandard.count).mockResolvedValue(0);
    vi.mocked(prisma.itemMisconception.count).mockResolvedValue(0);

    try {
      await calculateMetadataCompleteness(ITEM_ID, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});
