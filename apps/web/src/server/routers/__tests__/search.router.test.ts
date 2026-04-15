// search.router 통합 테스트
// 실제 test DB(`mathitem_test`)에 대해 createCallerFactory + Prisma로 검증한다.
// Meilisearch / similarity / cache는 service 경계에서 mock.
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

// ─────────────────────────────────────────────
// Env
// ─────────────────────────────────────────────
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/mathitem_test?schema=public";
process.env.DATABASE_URL ??= TEST_DB_URL;
process.env.DIRECT_URL ??= TEST_DB_URL;
process.env.TEST_DATABASE_URL ??= TEST_DB_URL;

// ─────────────────────────────────────────────
// Mock: auth
// ─────────────────────────────────────────────
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// ─────────────────────────────────────────────
// Mock: 외부 의존
// ─────────────────────────────────────────────
vi.mock("../../services/meilisearch.service", () => ({
  searchItems: vi.fn().mockResolvedValue({
    hitIds: [],
    total: 0,
    facets: { schoolLevel: {}, grade: {}, itemType: {}, difficulty: {} },
    queryTimeMs: 1,
  }),
  indexItem: vi.fn().mockResolvedValue(undefined),
  deleteItemFromIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/similarity.service", () => ({
  findSimilarItems: vi.fn().mockResolvedValue([]),
}));

// 캐시는 fetcher를 그대로 통과시켜 Prisma 폴백을 검증한다.
vi.mock("../../services/cache.service", () => ({
  cacheGetOrSet: vi.fn(async (_key: string, _ttl: number, fetcher: () => unknown) =>
    fetcher(),
  ),
  buildSearchCacheKey: vi.fn(() => "test-key"),
  CACHE_TTL: {
    SEARCH_RESULTS: 30,
    QUALITY_METRICS: 60,
    SKILL_GRAPH: 300,
    SKILL_LIST: 120,
    SIMILAR_ITEMS: 300,
  },
  CACHE_PREFIX: {
    SEARCH: "cache:search:",
    METRICS: "cache:metrics:",
    SKILL_GRAPH: "cache:skill-graph:",
    SIMILAR: "cache:similar:",
  },
}));

// ─────────────────────────────────────────────
// 라우터 / Prisma import (mock 등록 이후)
// ─────────────────────────────────────────────
import { createCallerFactory } from "../../trpc";
import { searchRouter } from "../search.router";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
const createCaller = createCallerFactory(searchRouter);

function makeCaller(role: UserRole | null) {
  if (role == null) {
    return createCaller({ prisma, session: null, user: null });
  }
  const user = {
    id: `test-${role}-search`,
    email: `${role}-search@test.com`,
    name: `Test ${role}`,
    role,
  };
  const session = {
    user,
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
  return createCaller({
    prisma,
    session: session as never,
    user: user as never,
  });
}

const ORG_ID = "default-org";
const TEST_PREFIX = "router-search-test";

// ─────────────────────────────────────────────
// Setup: 시드 데이터
// ─────────────────────────────────────────────
const createdItemIds: string[] = [];
const createdRecEventIds: string[] = [];

beforeAll(async () => {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Default Org (Test)",
      slug: "default-org-test",
    },
  });

  for (const role of ["admin", "reviewer", "teacher"] as const) {
    await prisma.user.upsert({
      where: { email: `${role}-search@test.com` },
      update: { role },
      create: {
        id: `test-${role}-search`,
        email: `${role}-search@test.com`,
        name: `Test ${role}`,
        role,
      },
    });
  }

  // Prisma-only 폴백 경로 검증용 approved 문항 1건
  const approved = await prisma.item.create({
    data: {
      orgId: ORG_ID,
      bodyLatex: `${TEST_PREFIX} approved fixture`,
      answer: { value: "1", format: "exact_value" },
      schoolLevel: "middle",
      grade: 8,
      itemType: "short_answer",
      answerFormat: "exact_value",
      status: "approved",
      currentVersion: 1,
    },
  });
  createdItemIds.push(approved.id);

  // teacher의 status 필터링 검증을 위한 draft 문항 1건
  const draft = await prisma.item.create({
    data: {
      orgId: ORG_ID,
      bodyLatex: `${TEST_PREFIX} draft fixture`,
      answer: { value: "2", format: "exact_value" },
      schoolLevel: "middle",
      grade: 8,
      itemType: "short_answer",
      answerFormat: "exact_value",
      status: "draft",
      currentVersion: 1,
    },
  });
  createdItemIds.push(draft.id);
});

afterAll(async () => {
  if (createdRecEventIds.length > 0) {
    await prisma.recommendationEvent.deleteMany({
      where: { id: { in: createdRecEventIds } },
    });
  }
  // 이 테스트가 직접 만든 RecommendationEvent (id 추적 못한 케이스)도 정리
  await prisma.recommendationEvent.deleteMany({
    where: {
      orgId: ORG_ID,
      itemIds: { hasSome: createdItemIds },
    },
  });

  if (createdItemIds.length > 0) {
    await prisma.itemVersion.deleteMany({
      where: { itemId: { in: createdItemIds } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: createdItemIds } },
    });
  }
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────
describe("search.router", () => {
  it("happy path: reviewer가 텍스트 쿼리 없이 검색하면 Prisma 폴백으로 결과를 받는다", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.items({
      page: 1,
      limit: 50,
      filters: { grade: 8, schoolLevel: "middle" },
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result.total).toBeGreaterThanOrEqual(2);
    const ids = result.items.map((i) => i.id);
    // reviewer는 draft + approved 모두 봐야 한다
    expect(ids).toEqual(expect.arrayContaining(createdItemIds));
  });

  it("teacher 호출 시 status 필터가 강제로 approved로 제한된다", async () => {
    const caller = makeCaller("teacher");

    const result = await caller.items({
      page: 1,
      limit: 50,
      filters: { grade: 8, schoolLevel: "middle" },
    });

    // teacher는 approved 문항만 봐야 한다 (draft 문항 제외)
    const statuses = result.items.map((i) => i.status);
    expect(statuses.every((s) => s === "approved")).toBe(true);
    expect(result.items.find((i) => i.id === createdItemIds[0])).toBeDefined();
    expect(result.items.find((i) => i.id === createdItemIds[1])).toBeUndefined();
  });

  it("happy path: 텍스트 쿼리 검색 시 Meilisearch mock을 호출한다", async () => {
    const { searchItems } = await import("../../services/meilisearch.service");
    const caller = makeCaller("reviewer");

    const result = await caller.items({
      query: "방정식",
      page: 1,
      limit: 10,
    });

    expect(searchItems).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("similarFeedback: mutation이 RecommendationEvent를 생성한다", async () => {
    const caller = makeCaller("reviewer");

    const before = await prisma.recommendationEvent.count({
      where: { orgId: ORG_ID, itemIds: { hasSome: createdItemIds } },
    });

    const result = await caller.similarFeedback({
      sourceItemId: createdItemIds[0]!,
      targetItemId: createdItemIds[1]!,
      relevant: true,
    });

    expect(result.success).toBe(true);

    const after = await prisma.recommendationEvent.count({
      where: { orgId: ORG_ID, itemIds: { hasSome: createdItemIds } },
    });
    expect(after).toBe(before + 1);
  });

  it("미인증 caller가 items를 호출하면 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.items({ page: 1, limit: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("input validation: limit이 50을 초과하면 BAD_REQUEST", async () => {
    const caller = makeCaller("reviewer");

    await expect(
      caller.items({ page: 1, limit: 999 } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // ─── 추가 커버리지: hasSearchCriteria 분기 (lines 334-343) ───

  it("쿼리도 필터도 없으면 Prisma 폴백을 사용한다 (hasSearchCriteria=false)", async () => {
    const { searchItems } = await import("../../services/meilisearch.service");
    const caller = makeCaller("reviewer");

    // 쿼리 없음 + 필터 없음
    const result = await caller.items({ page: 1, limit: 10 });

    // Meilisearch가 호출되지 않아야 함
    expect(searchItems).not.toHaveBeenCalled();
    expect(result).toHaveProperty("items");
  });

  it("빈 문자열 쿼리는 Prisma 폴백을 사용한다", async () => {
    const { searchItems } = await import("../../services/meilisearch.service");
    const caller = makeCaller("reviewer");

    const result = await caller.items({ query: "   ", page: 1, limit: 10 });

    expect(searchItems).not.toHaveBeenCalled();
    expect(result).toHaveProperty("items");
  });

  it("빈 배열 필터는 Prisma 폴백을 사용한다", async () => {
    const { searchItems } = await import("../../services/meilisearch.service");
    const caller = makeCaller("reviewer");

    const result = await caller.items({
      page: 1,
      limit: 10,
      filters: { skillIds: [], standardIds: [] },
    });

    expect(searchItems).not.toHaveBeenCalled();
    expect(result).toHaveProperty("items");
  });

  // ─── 추가 커버리지: similar 프로시저 (lines 407-444) ───

  it("happy path: similar가 빈 결과를 반환한다 (mock: findSimilarItems=[])", async () => {
    const caller = makeCaller("reviewer");

    const result = await caller.similar({
      itemId: createdItemIds[0]!,
      limit: 5,
    });

    expect(result).toHaveProperty("items");
    expect(result.items).toEqual([]);
  });

  it("similar: findSimilarItems가 결과를 반환하면 DB에서 문항을 조회한다", async () => {
    const { findSimilarItems } = await import("../../services/similarity.service");
    const mockFind = vi.mocked(findSimilarItems);

    // mock을 결과가 있는 경우로 설정
    mockFind.mockResolvedValueOnce([
      {
        itemId: createdItemIds[0]!,
        score: 0.95,
        signals: { skillOverlap: 0.8, difficultyDelta: 0.1, sameType: 1, bloomGap: 0, gradeGap: 0, standardOverlap: 0 },
        explanation: "High similarity",
      },
    ]);

    const caller = makeCaller("reviewer");

    const result = await caller.similar({
      itemId: createdItemIds[1]!,
      limit: 5,
    });

    expect(result).toHaveProperty("items");
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.score).toBe(0.95);
    expect(result.items[0]!.item.id).toBe(createdItemIds[0]);
  });

  it("similar: DB에 없는 itemId는 필터링된다", async () => {
    const { findSimilarItems } = await import("../../services/similarity.service");
    const mockFind = vi.mocked(findSimilarItems);

    mockFind.mockResolvedValueOnce([
      {
        itemId: "nonexistent-item-id-xyz",
        score: 0.5,
        signals: { skillOverlap: 0, difficultyDelta: 0, sameType: 0, bloomGap: 0, gradeGap: 0, standardOverlap: 0 },
        explanation: "Should be filtered",
      },
    ]);

    const caller = makeCaller("reviewer");

    const result = await caller.similar({
      itemId: createdItemIds[0]!,
      limit: 5,
    });

    expect(result.items).toEqual([]);
  });

  it("미인증 caller가 similar를 호출하면 UNAUTHORIZED", async () => {
    const caller = makeCaller(null);

    await expect(
      caller.similar({ itemId: "any", limit: 5 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
