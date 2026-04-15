// remediation.service 단위 테스트 — Prisma + recommendation 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// -------------------------------------------------
// Mocks
// -------------------------------------------------

vi.mock("@math-item-os/db", () => ({
  prisma: {
    misconception: { findUnique: vi.fn() },
    skill: { findMany: vi.fn() },
    prerequisiteEdge: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
  },
}));

vi.mock("../recommendation.service", () => ({
  logRemediationRecommendation: vi.fn(async () => ({ event: { id: "ev-1" } })),
}));

import { prisma } from "@math-item-os/db";
import { logRemediationRecommendation } from "../recommendation.service";
import { getRemediationPath } from "../remediation.service";

const ORG = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------
// helper: 문항 팩토리
// -------------------------------------------------

function makeItem(id: string, difficulty: number) {
  return {
    id,
    difficultyAuthor: difficulty,
    skills: [],
    standards: [],
    misconceptions: [],
  } as never;
}

// -------------------------------------------------
// getRemediationPath
// -------------------------------------------------

describe("getRemediationPath", () => {
  it("오개념이 존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue(null);

    await expect(
      getRemediationPath({ misconceptionId: "bad" }, ORG),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: "other-org",
      relatedSkills: ["SK001"],
    } as never);

    await expect(
      getRemediationPath({ misconceptionId: "mc-1" }, ORG),
    ).rejects.toThrow(TRPCError);
  });

  it("relatedSkills가 비어있으면 빈 경로 반환", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "테스트 오개념",
      relatedSkills: [],
    } as never);

    const result = await getRemediationPath({ misconceptionId: "mc-1" }, ORG);
    expect(result.steps).toEqual([]);
  });

  it("스킬 코드로 조회한 결과가 없으면 빈 경로 반환", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "오개념",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([]);

    const result = await getRemediationPath({ misconceptionId: "mc-1" }, ORG);
    expect(result.steps).toEqual([]);
  });

  it("3단계 교정 경로를 생성한다", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "부호 오류",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "skill-1" },
    ] as never);

    // Phase 1: 선수 개념 엣지
    vi.mocked(prisma.prerequisiteEdge.findMany).mockResolvedValue([
      { fromSkillId: "prereq-skill-1" },
    ] as never);

    // item.findMany 순차 호출: phase1, phase2, phase3
    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce([makeItem("prereq-1", 2)])   // prerequisite_review
      .mockResolvedValueOnce([makeItem("basic-1", 3)])     // basic_practice
      .mockResolvedValueOnce([makeItem("confirm-1", 4)]);  // confirmation

    const result = await getRemediationPath(
      { misconceptionId: "mc-1", difficulty: 3, limit: 3 },
      ORG,
    );

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]!.phase).toBe("prerequisite_review");
    expect(result.steps[0]!.items).toHaveLength(1);
    expect(result.steps[1]!.phase).toBe("basic_practice");
    expect(result.steps[2]!.phase).toBe("confirmation");

    // 추천 이벤트 로깅 호출됨
    expect(logRemediationRecommendation).toHaveBeenCalledOnce();
  });

  it("선수 스킬이 없으면 phase1이 비어있다", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "오개념",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "skill-1" },
    ] as never);

    // 선수 스킬 엣지 없음
    vi.mocked(prisma.prerequisiteEdge.findMany).mockResolvedValue([]);

    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce([makeItem("basic-1", 3)])     // basic_practice
      .mockResolvedValueOnce([makeItem("confirm-1", 4)]);  // confirmation

    const result = await getRemediationPath(
      { misconceptionId: "mc-1" },
      ORG,
    );

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]!.items).toHaveLength(0); // prerequisite empty
    expect(result.steps[1]!.items).toHaveLength(1);
  });

  it("모든 단계에 문항이 없으면 로깅하지 않는다", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "오개념",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "skill-1" },
    ] as never);

    vi.mocked(prisma.prerequisiteEdge.findMany).mockResolvedValue([
      { fromSkillId: "prereq-1" },
    ] as never);

    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const result = await getRemediationPath(
      { misconceptionId: "mc-1" },
      ORG,
    );

    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.items.length === 0)).toBe(true);
    expect(logRemediationRecommendation).not.toHaveBeenCalled();
  });

  it("기본값: difficulty=3, limit=3", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "오개념",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "skill-1" },
    ] as never);

    vi.mocked(prisma.prerequisiteEdge.findMany).mockResolvedValue([]);
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getRemediationPath({ misconceptionId: "mc-1" }, ORG);

    // basic_practice에서 difficulty +-1 범위 = gte:2, lte:4
    const basicCall = vi.mocked(prisma.item.findMany).mock.calls[0]![0];
    expect(basicCall!.take).toBe(3);
  });

  it("단계별 중복 방지 — 이전 단계에서 선택된 문항은 제외", async () => {
    vi.mocked(prisma.misconception.findUnique).mockResolvedValue({
      id: "mc-1",
      orgId: ORG,
      code: "MC001",
      title: "오개념",
      relatedSkills: ["SK001"],
    } as never);

    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "skill-1" },
    ] as never);

    vi.mocked(prisma.prerequisiteEdge.findMany).mockResolvedValue([
      { fromSkillId: "prereq-1" },
    ] as never);

    // phase 1 returns item "shared-1"
    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce([makeItem("shared-1", 2)])   // prereq
      .mockResolvedValueOnce([makeItem("basic-1", 3)])     // basic
      .mockResolvedValueOnce([makeItem("confirm-1", 4)]);  // confirm

    await getRemediationPath({ misconceptionId: "mc-1", difficulty: 3 }, ORG);

    // Phase 2 where should exclude "shared-1"
    const basicWhere = vi.mocked(prisma.item.findMany).mock.calls[1]![0]!.where;
    expect(basicWhere).toHaveProperty("id");

    // Phase 3 where should exclude both "shared-1" and "basic-1"
    const confirmWhere = vi.mocked(prisma.item.findMany).mock.calls[2]![0]!.where;
    expect(confirmWhere).toHaveProperty("id");
  });
});
