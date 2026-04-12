// recommendation.service 단위 테스트 — Prisma 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// -------------------------------------------------
// Prisma mock
// -------------------------------------------------

vi.mock("@math-item-os/db", () => ({
  prisma: {
    recommendationEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@math-item-os/db";
import {
  createRecommendationEvent,
  logRemediationRecommendation,
  updateRecommendationFeedback,
} from "../recommendation.service";

const ORG = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------
// createRecommendationEvent
// -------------------------------------------------

describe("createRecommendationEvent", () => {
  it("추천 이벤트를 생성하고 반환한다", async () => {
    const event = { id: "ev-1", orgId: ORG, recType: "practice" };
    vi.mocked(prisma.recommendationEvent.create).mockResolvedValue(event as never);

    const result = await createRecommendationEvent(
      {
        recType: "practice" as never,
        itemIds: ["item-1", "item-2"],
        reasoning: { strategy: "test" },
      },
      ORG,
    );

    expect(result).toEqual({ event });
    expect(prisma.recommendationEvent.create).toHaveBeenCalledWith({
      data: {
        orgId: ORG,
        recType: "practice",
        itemIds: ["item-1", "item-2"],
        reasoning: { strategy: "test" },
      },
    });
  });

  it("빈 itemIds도 허용한다", async () => {
    const event = { id: "ev-2" };
    vi.mocked(prisma.recommendationEvent.create).mockResolvedValue(event as never);

    const result = await createRecommendationEvent(
      {
        recType: "review" as never,
        itemIds: [],
        reasoning: {},
      },
      ORG,
    );

    expect(result).toEqual({ event });
  });
});

// -------------------------------------------------
// logRemediationRecommendation
// -------------------------------------------------

describe("logRemediationRecommendation", () => {
  it("교정 경로를 remediation 타입으로 기록한다", async () => {
    const event = { id: "ev-3" };
    vi.mocked(prisma.recommendationEvent.create).mockResolvedValue(event as never);

    const result = await logRemediationRecommendation(
      {
        misconceptionId: "mc-1",
        misconceptionCode: "MC001",
        difficulty: 3,
        steps: [
          {
            phase: "prerequisite_review",
            itemIds: ["i1", "i2"],
            explanation: "선수 복습",
          },
          {
            phase: "basic_practice",
            itemIds: ["i3"],
            explanation: "기본 연습",
          },
        ],
      },
      ORG,
    );

    expect(result).toEqual({ event });

    const call = vi.mocked(prisma.recommendationEvent.create).mock.calls[0]![0];
    expect(call.data.recType).toBe("remediation");
    // 모든 단계의 itemIds가 평면화됨
    expect(call.data.itemIds).toEqual(["i1", "i2", "i3"]);
    // reasoning에 오개념 정보 포함
    const reasoning = call.data.reasoning as Record<string, unknown>;
    expect(reasoning).toHaveProperty("misconceptionId", "mc-1");
    expect(reasoning).toHaveProperty("type", "remediation_path");
  });

  it("단계가 비어도 빈 itemIds로 기록한다", async () => {
    const event = { id: "ev-4" };
    vi.mocked(prisma.recommendationEvent.create).mockResolvedValue(event as never);

    await logRemediationRecommendation(
      {
        misconceptionId: "mc-2",
        misconceptionCode: "MC002",
        difficulty: 2,
        steps: [],
      },
      ORG,
    );

    const call = vi.mocked(prisma.recommendationEvent.create).mock.calls[0]![0];
    expect(call.data.itemIds).toEqual([]);
  });
});

// -------------------------------------------------
// updateRecommendationFeedback
// -------------------------------------------------

describe("updateRecommendationFeedback", () => {
  it("이벤트가 존재하지 않으면 success: false", async () => {
    vi.mocked(prisma.recommendationEvent.findUnique).mockResolvedValue(null);

    const result = await updateRecommendationFeedback(
      { eventId: "bad-id", accepted: true },
      ORG,
    );

    expect(result).toEqual({ success: false });
    expect(prisma.recommendationEvent.update).not.toHaveBeenCalled();
  });

  it("다른 조직이면 success: false", async () => {
    vi.mocked(prisma.recommendationEvent.findUnique).mockResolvedValue({
      id: "ev-1",
      orgId: "other-org",
    } as never);

    const result = await updateRecommendationFeedback(
      { eventId: "ev-1", accepted: true },
      ORG,
    );

    expect(result).toEqual({ success: false });
  });

  it("수락 피드백을 업데이트한다", async () => {
    vi.mocked(prisma.recommendationEvent.findUnique).mockResolvedValue({
      id: "ev-1",
      orgId: ORG,
    } as never);

    const updated = { id: "ev-1", accepted: true, feedback: null };
    vi.mocked(prisma.recommendationEvent.update).mockResolvedValue(updated as never);

    const result = await updateRecommendationFeedback(
      { eventId: "ev-1", accepted: true },
      ORG,
    );

    expect(result).toEqual({ event: updated });
    expect(prisma.recommendationEvent.update).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { accepted: true, feedback: undefined },
    });
  });

  it("거절 + 피드백 메시지를 업데이트한다", async () => {
    vi.mocked(prisma.recommendationEvent.findUnique).mockResolvedValue({
      id: "ev-1",
      orgId: ORG,
    } as never);

    const updated = { id: "ev-1", accepted: false, feedback: "난이도 부적합" };
    vi.mocked(prisma.recommendationEvent.update).mockResolvedValue(updated as never);

    const result = await updateRecommendationFeedback(
      { eventId: "ev-1", accepted: false, feedback: "난이도 부적합" },
      ORG,
    );

    expect(result).toEqual({ event: updated });
    expect(prisma.recommendationEvent.update).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { accepted: false, feedback: "난이도 부적합" },
    });
  });
});
