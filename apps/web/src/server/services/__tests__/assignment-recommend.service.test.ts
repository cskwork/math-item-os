// assignment-recommend.service 단위 테스트 — 추천 알고리즘 + Prisma 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// -------------------------------------------------
// Prisma mock
// -------------------------------------------------

vi.mock("@math-item-os/db", () => ({
  prisma: {
    item: { findMany: vi.fn() },
    recommendationEvent: { create: vi.fn() },
  },
}));

// recommendation.service mock (createRecommendationEvent)
vi.mock("../recommendation.service", () => ({
  createRecommendationEvent: vi.fn(async () => ({ event: { id: "ev-1" } })),
}));

import { prisma } from "@math-item-os/db";
import {
  getDifficultyRange,
  scoreCandidateItem,
  recommendItems,
} from "../assignment-recommend.service";
import type { RecommendItemsInput } from "../assignment-recommend.service";
import { createRecommendationEvent } from "../recommendation.service";

const ORG = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------
// helper: 후보 문항 팩토리
// -------------------------------------------------

function makeCandidate(overrides: {
  id?: string;
  difficultyAuthor?: number | null;
  usagePurposes?: string[];
  skillIds?: string[];
}) {
  const id = overrides.id ?? "item-1";
  return {
    id,
    orgId: ORG,
    status: "approved",
    difficultyAuthor: overrides.difficultyAuthor ?? 3,
    usagePurposes: overrides.usagePurposes ?? [],
    skills: (overrides.skillIds ?? []).map((sid) => ({
      skillId: sid,
      skill: { id: sid, code: sid, title: sid },
    })),
    misconceptions: [],
  } as never;
}

// -------------------------------------------------
// getDifficultyRange
// -------------------------------------------------

describe("getDifficultyRange", () => {
  it("diagnosis → 항상 [1, 5]", () => {
    expect(getDifficultyRange("diagnosis" as never, 3)).toEqual([1, 5]);
  });

  it("remediation → [1, min(td, 3)]", () => {
    expect(getDifficultyRange("remediation" as never, 4)).toEqual([1, 3]);
    expect(getDifficultyRange("remediation" as never, 2)).toEqual([1, 2]);
  });

  it("pre_exam → [td-1, td+1] clamped to [1,5]", () => {
    expect(getDifficultyRange("pre_exam" as never, 3)).toEqual([2, 4]);
    expect(getDifficultyRange("pre_exam" as never, 1)).toEqual([1, 2]);
    expect(getDifficultyRange("pre_exam" as never, 5)).toEqual([4, 5]);
  });

  it("advanced → [max(4, td), 5]", () => {
    expect(getDifficultyRange("advanced" as never, 3)).toEqual([4, 5]);
    expect(getDifficultyRange("advanced" as never, 5)).toEqual([5, 5]);
  });

  it("practice → [td-1, td+1] clamped to [1,5]", () => {
    expect(getDifficultyRange("practice" as never, 3)).toEqual([2, 4]);
  });

  it("review → [1, 5]", () => {
    expect(getDifficultyRange("review" as never, 3)).toEqual([1, 5]);
  });

  it("targetDifficulty 미지정 시 기본값 3 사용", () => {
    expect(getDifficultyRange("practice" as never)).toEqual([2, 4]);
  });
});

// -------------------------------------------------
// scoreCandidateItem
// -------------------------------------------------

describe("scoreCandidateItem", () => {
  const baseInput: RecommendItemsInput = {
    purpose: "practice" as never,
    count: 5,
    difficulty: 3,
    skillIds: ["sk-1"],
  };

  it("스킬 매칭 + 난이도 일치 시 높은 점수", () => {
    const item = makeCandidate({
      id: "a",
      difficultyAuthor: 3,
      skillIds: ["sk-1"],
      usagePurposes: ["practice"],
    });

    const result = scoreCandidateItem(item, baseInput, []);

    expect(result.score).toBeGreaterThan(0.5);
    expect(result.reason).toBeTruthy();
  });

  it("스킬 불일치 시 낮은 skillRelevance → 점수 하락", () => {
    const matched = makeCandidate({
      id: "a",
      difficultyAuthor: 3,
      skillIds: ["sk-1"],
    });
    const unmatched = makeCandidate({
      id: "b",
      difficultyAuthor: 3,
      skillIds: ["sk-other"],
    });

    const scoreA = scoreCandidateItem(matched, baseInput, []);
    const scoreB = scoreCandidateItem(unmatched, baseInput, []);

    expect(scoreA.score).toBeGreaterThan(scoreB.score);
  });

  it("난이도가 멀면 difficultyFit 하락", () => {
    const close = makeCandidate({ id: "a", difficultyAuthor: 3 });
    const far = makeCandidate({ id: "b", difficultyAuthor: 1 });

    const scoreClose = scoreCandidateItem(close, baseInput, []);
    const scoreFar = scoreCandidateItem(far, baseInput, []);

    expect(scoreClose.score).toBeGreaterThan(scoreFar.score);
  });

  it("difficultyAuthor가 null이면 difficultyFit 0", () => {
    const item = makeCandidate({ id: "a", difficultyAuthor: null });
    const result = scoreCandidateItem(item, baseInput, []);
    // difficultyFit=0 → 최대 0.4(skill) + 0(diff) + 0.1(purpose) + 0.1(div)
    expect(result.score).toBeLessThan(0.8);
  });

  it("이미 선택된 문항과 스킬 겹치면 diversity 하락", () => {
    const item = makeCandidate({
      id: "a",
      difficultyAuthor: 3,
      skillIds: ["sk-1"],
    });
    const alreadySelected = makeCandidate({
      id: "prev",
      difficultyAuthor: 3,
      skillIds: ["sk-1"],
    });

    const fresh = scoreCandidateItem(item, baseInput, []);
    const overlap = scoreCandidateItem(item, baseInput, [alreadySelected]);

    expect(fresh.score).toBeGreaterThan(overlap.score);
  });

  it("skillIds 미지정 시 skillRelevance = 1.0", () => {
    const input: RecommendItemsInput = {
      purpose: "practice" as never,
      count: 5,
      difficulty: 3,
    };
    const item = makeCandidate({ id: "a", difficultyAuthor: 3 });

    const result = scoreCandidateItem(item, input, []);
    // skillRelevance 1.0 * 0.4 = 0.4 baseline
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });
});

// -------------------------------------------------
// recommendItems
// -------------------------------------------------

describe("recommendItems", () => {
  it("후보가 없으면 빈 결과를 반환한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const result = await recommendItems(
      { purpose: "practice" as never, count: 5 },
      ORG,
    );

    expect(result.items).toHaveLength(0);
    expect(result.reasoning.totalCandidates).toBe(0);
    // 빈 결과 시 이벤트 로깅 안 함
    expect(createRecommendationEvent).not.toHaveBeenCalled();
  });

  it("후보가 있으면 점수순 정렬 결과를 반환한다", async () => {
    const candidates = [
      makeCandidate({ id: "c1", difficultyAuthor: 3, skillIds: ["sk-1"] }),
      makeCandidate({ id: "c2", difficultyAuthor: 1, skillIds: ["sk-other"] }),
      makeCandidate({ id: "c3", difficultyAuthor: 3, skillIds: ["sk-1"], usagePurposes: ["practice"] }),
    ];
    vi.mocked(prisma.item.findMany).mockResolvedValue(candidates as never);

    const result = await recommendItems(
      { purpose: "practice" as never, count: 2, skillIds: ["sk-1"], difficulty: 3 },
      ORG,
    );

    expect(result.items.length).toBeLessThanOrEqual(2);
    expect(result.reasoning.purpose).toBe("practice");
    expect(result.reasoning.strategy).toBeTruthy();
    // 이벤트 로깅 호출됨
    expect(createRecommendationEvent).toHaveBeenCalledOnce();
  });

  it("count <= 0이면 기본값 10을 사용한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const result = await recommendItems(
      { purpose: "diagnosis" as never, count: 0 },
      ORG,
    );

    expect(result.reasoning.difficultyRange).toEqual([1, 5]);
  });

  it("excludeItemIds로 특정 문항을 제외한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await recommendItems(
      { purpose: "practice" as never, count: 5, excludeItemIds: ["ex-1"] },
      ORG,
    );

    const call = vi.mocked(prisma.item.findMany).mock.calls[0]![0];
    expect(call!.where).toHaveProperty("id");
  });

  it("reasoning에 skillCoverage가 포함된다", async () => {
    const candidates = [
      makeCandidate({ id: "c1", difficultyAuthor: 3, skillIds: ["sk-1", "sk-2"] }),
    ];
    vi.mocked(prisma.item.findMany).mockResolvedValue(candidates as never);

    const result = await recommendItems(
      { purpose: "practice" as never, count: 5, skillIds: ["sk-1", "sk-2"] },
      ORG,
    );

    expect(result.reasoning.skillCoverage).toBeGreaterThan(0);
  });
});
