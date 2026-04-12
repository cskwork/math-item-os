// quality-metrics.service 단위 테스트 — Prisma + cache.service 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const { mockItemCount, mockItemGroupBy, mockItemAggregate, mockAuditLogFindMany } =
  vi.hoisted(() => ({
    mockItemCount: vi.fn(),
    mockItemGroupBy: vi.fn(),
    mockItemAggregate: vi.fn(),
    mockAuditLogFindMany: vi.fn(),
  }));

vi.mock("@math-item-os/db", () => ({
  prisma: {
    item: {
      count: mockItemCount,
      groupBy: mockItemGroupBy,
      aggregate: mockItemAggregate,
    },
    auditLog: {
      findMany: mockAuditLogFindMany,
    },
  },
}));

// cacheGetOrSet를 바이패스하여 항상 fetcher를 실행한다
vi.mock("../cache.service", () => ({
  cacheGetOrSet: vi.fn(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher(),
  ),
  CACHE_TTL: { QUALITY_METRICS: 60 },
  CACHE_PREFIX: { METRICS: "cache:metrics:" },
}));

import { getQualityMetrics } from "../quality-metrics.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// getQualityMetrics
// ─────────────────────────────────────────────

describe("getQualityMetrics", () => {
  function setupMocks(overrides?: {
    totalItems?: number;
    statusCounts?: { status: string; _count: { id: number } }[];
    totalForMeta?: number;
    completeCount?: number;
    avgDifficulty?: number | null;
    recentActivity?: unknown[];
    pendingReviews?: number;
    totalGenerated?: number;
    passedGenerated?: number;
  }) {
    const opts = {
      totalItems: 100,
      statusCounts: [
        { status: "draft", _count: { id: 40 } },
        { status: "approved", _count: { id: 60 } },
      ],
      totalForMeta: 100,
      completeCount: 80,
      avgDifficulty: 3.5,
      recentActivity: [{ id: "act-1", tableName: "items", action: "create", performedBy: "u1", createdAt: new Date() }],
      pendingReviews: 15,
      totalGenerated: 20,
      passedGenerated: 16,
      ...overrides,
    };

    // prisma.item.count is called multiple times with different where clauses.
    // Order: totalItems, metadataStats[0], metadataStats[1], pendingReviews, generatedStats[0], generatedStats[1]
    mockItemCount
      .mockResolvedValueOnce(opts.totalItems) // totalItems
      .mockResolvedValueOnce(opts.totalForMeta) // metadataStats[0]
      .mockResolvedValueOnce(opts.completeCount) // metadataStats[1]
      .mockResolvedValueOnce(opts.pendingReviews) // pendingReviews
      .mockResolvedValueOnce(opts.totalGenerated) // generatedStats[0]
      .mockResolvedValueOnce(opts.passedGenerated); // generatedStats[1]

    mockItemGroupBy.mockResolvedValue(opts.statusCounts);
    mockItemAggregate.mockResolvedValue({
      _avg: { difficultyAuthor: opts.avgDifficulty },
    });
    mockAuditLogFindMany.mockResolvedValue(opts.recentActivity);
  }

  it("모든 메트릭을 올바르게 계산한다", async () => {
    setupMocks();

    const result = await getQualityMetrics("org-1");

    expect(result.totalItems).toBe(100);
    expect(result.byStatus).toEqual({ draft: 40, approved: 60 });
    expect(result.metadataCompleteness).toBe(80); // 80/100 * 100
    expect(result.avgDifficulty).toBe(3.5);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.pendingReviews).toBe(15);
    expect(result.generatedItemPassRate).toBe(80); // 16/20 * 100
  });

  it("문항이 0개일 때 metadataCompleteness가 0", async () => {
    setupMocks({ totalItems: 0, totalForMeta: 0, completeCount: 0 });

    const result = await getQualityMetrics("org-1");
    expect(result.metadataCompleteness).toBe(0);
  });

  it("생성 문항이 0개일 때 generatedItemPassRate가 0", async () => {
    setupMocks({ totalGenerated: 0, passedGenerated: 0 });

    const result = await getQualityMetrics("org-1");
    expect(result.generatedItemPassRate).toBe(0);
  });

  it("avgDifficulty가 null이면 0을 반환한다", async () => {
    setupMocks({ avgDifficulty: null });

    const result = await getQualityMetrics("org-1");
    expect(result.avgDifficulty).toBe(0);
  });

  it("byStatus를 상태 코드 기반으로 매핑한다", async () => {
    setupMocks({
      statusCounts: [
        { status: "draft", _count: { id: 10 } },
        { status: "reviewed", _count: { id: 20 } },
        { status: "approved", _count: { id: 30 } },
        { status: "retired", _count: { id: 5 } },
      ],
    });

    const result = await getQualityMetrics("org-1");
    expect(result.byStatus).toEqual({
      draft: 10,
      reviewed: 20,
      approved: 30,
      retired: 5,
    });
  });

  it("metadataCompleteness를 반올림한다", async () => {
    setupMocks({ totalForMeta: 3, completeCount: 1 });

    const result = await getQualityMetrics("org-1");
    expect(result.metadataCompleteness).toBe(33); // Math.round(1/3*100)
  });
});
