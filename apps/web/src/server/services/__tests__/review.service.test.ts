// review.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// 외부 의존성 모킹
// ─────────────────────────────────────────────

vi.mock("@math-item-os/db", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../audit.service", () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

import { prisma } from "@math-item-os/db";
import {
  listReviewTasks,
  updateReviewTask,
} from "../review.service";
import { createAuditLog } from "../audit.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const ORG_ID = "org-1";
const USER_ID = "user-1";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    bodyLatex: "x + 1 = 2 일차방정식 풀이",
    status: "draft",
    createdBy: USER_ID,
    difficultyAuthor: 3,
    schoolLevel: "middle",
    grade: 7,
    isGenerated: false,
    createdAt: new Date("2025-01-01"),
    skills: [{ id: "sk-1" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// listReviewTasks
// ─────────────────────────────────────────────

describe("listReviewTasks", () => {
  it("기본 검수 작업 목록을 반환한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([makeItem()] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({
      orgId: ORG_ID,
      page: 1,
      limit: 20,
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskType).toBe("tag_review");
    expect(result.tasks[0].status).toBe("pending"); // draft -> pending
    expect(result.tasks[0].priority).toBe(3); // 6 - 3 = 3
    expect(result.total).toBe(1);
  });

  it("isGenerated=true이면 generation_review 타입으로 파생한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ isGenerated: true }),
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({ orgId: ORG_ID, page: 1, limit: 20 });

    expect(result.tasks[0].taskType).toBe("generation_review");
  });

  it("스킬이 없으면 tag_review로 파생한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ skills: [] }),
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({ orgId: ORG_ID, page: 1, limit: 20 });

    expect(result.tasks[0].taskType).toBe("tag_review");
  });

  it("status 필터가 completed이면 approved 문항을 조회한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(0);

    await listReviewTasks({ orgId: ORG_ID, status: "completed", page: 1, limit: 20 });

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["approved"] },
        }),
      }),
    );
  });

  it("status 필터가 rejected이면 retired 문항을 조회한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(0);

    await listReviewTasks({ orgId: ORG_ID, status: "rejected", page: 1, limit: 20 });

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["retired"] },
        }),
      }),
    );
  });

  it("priority 필터를 적용한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ difficultyAuthor: 3 }), // priority = 3
      makeItem({ id: "item-2", difficultyAuthor: 5 }), // priority = 1
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(2);

    const result = await listReviewTasks({
      orgId: ORG_ID,
      priority: 1,
      page: 1,
      limit: 20,
    });

    expect(result.tasks.every((t) => t.priority === 1)).toBe(true);
  });

  it("taskType이 generation_review이면 isGenerated=true 필터를 추가한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(0);

    await listReviewTasks({
      orgId: ORG_ID,
      taskType: "generation_review",
      page: 1,
      limit: 20,
    });

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isGenerated: true }),
      }),
    );
  });

  it("난이도가 null이면 priority=3을 반환한다", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ difficultyAuthor: null }),
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({ orgId: ORG_ID, page: 1, limit: 20 });

    expect(result.tasks[0].priority).toBe(3);
  });

  it("itemTitle은 bodyLatex의 처음 80자로 자른다", async () => {
    const longLatex = "a".repeat(100);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ bodyLatex: longLatex }),
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({ orgId: ORG_ID, page: 1, limit: 20 });

    expect(result.tasks[0].itemTitle).toHaveLength(80);
  });

  it("문항 상태별 검수 상태 매핑: reviewed -> in_progress", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      makeItem({ status: "reviewed" }),
    ] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(1);

    const result = await listReviewTasks({
      orgId: ORG_ID,
      status: "in_progress",
      page: 1,
      limit: 20,
    });

    expect(result.tasks[0].status).toBe("in_progress");
  });
});

// ─────────────────────────────────────────────
// updateReviewTask
// ─────────────────────────────────────────────

describe("updateReviewTask", () => {
  it("검수 상태를 completed로 업데이트하면 문항을 approved로 전환한다", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue(
      makeItem({ status: "approved" }) as never,
    );

    const result = await updateReviewTask("item-1", "completed", "좋습니다", USER_ID, ORG_ID);

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "approved" },
      }),
    );
    expect(result.status).toBe("completed");
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "approve",
        newData: expect.objectContaining({ reviewComment: "좋습니다" }),
      }),
    );
  });

  it("검수 상태를 rejected로 업데이트하면 문항을 retired로 전환한다", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue(
      makeItem({ status: "retired" }) as never,
    );

    const result = await updateReviewTask("item-1", "rejected", undefined, USER_ID, ORG_ID);

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "retired" },
      }),
    );
    expect(result.status).toBe("rejected");
  });

  it("검수 상태를 in_progress로 업데이트하면 문항을 reviewed로 전환한다", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue(
      makeItem({ status: "reviewed" }) as never,
    );

    await updateReviewTask("item-1", "in_progress", undefined, USER_ID, ORG_ID);

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "reviewed" },
      }),
    );
  });

  it("알 수 없는 검수 상태는 draft로 전환한다", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue(
      makeItem({ status: "draft" }) as never,
    );

    await updateReviewTask("item-1", "unknown", undefined, USER_ID, ORG_ID);

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "draft" },
      }),
    );
  });

  it("comment가 없으면 null로 기록한다", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue(makeItem() as never);

    await updateReviewTask("item-1", "completed", undefined, USER_ID, ORG_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newData: expect.objectContaining({ reviewComment: null }),
      }),
    );
  });
});
