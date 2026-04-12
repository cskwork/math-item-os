// cache.service 단위 테스트 — Redis 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Redis 모킹 — class 형태로 선언하여 new Redis()가 올바르게 동작
// ─────────────────────────────────────────────
const { mockRedis } = vi.hoisted(() => {
  const r = {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  };
  return { mockRedis: r };
});

vi.mock("ioredis", () => {
  return {
    Redis: class MockRedis {
      get = mockRedis.get;
      set = mockRedis.set;
      keys = mockRedis.keys;
      del = mockRedis.del;
      on = mockRedis.on;
    },
  };
});

import {
  cacheGet,
  cacheSet,
  cacheInvalidate,
  cacheGetOrSet,
  buildSearchCacheKey,
  CACHE_TTL,
  CACHE_PREFIX,
} from "../cache.service";

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cacheGet", () => {
  it("캐시 히트 시 파싱된 값을 반환한다", async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ foo: "bar" }));
    const result = await cacheGet<{ foo: string }>("key1");
    expect(result).toEqual({ foo: "bar" });
    expect(mockRedis.get).toHaveBeenCalledWith("key1");
  });

  it("캐시 미스 시 null을 반환한다", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await cacheGet("key2");
    expect(result).toBeNull();
  });

  it("Redis 오류 시 null을 반환한다", async () => {
    mockRedis.get.mockRejectedValue(new Error("connection refused"));
    const result = await cacheGet("key3");
    expect(result).toBeNull();
  });
});

describe("cacheSet", () => {
  it("값을 JSON으로 직렬화하여 저장한다", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await cacheSet("key1", { a: 1 }, 60);
    expect(mockRedis.set).toHaveBeenCalledWith("key1", '{"a":1}', "EX", 60);
  });

  it("Redis 오류 시 예외를 전파하지 않는다", async () => {
    mockRedis.set.mockRejectedValue(new Error("write error"));
    await expect(cacheSet("key1", "val", 30)).resolves.toBeUndefined();
  });
});

describe("cacheInvalidate", () => {
  it("프리픽스 매칭 키를 모두 삭제한다", async () => {
    mockRedis.keys.mockResolvedValue(["cache:search:a", "cache:search:b"]);
    mockRedis.del.mockResolvedValue(2);
    await cacheInvalidate("cache:search:");
    expect(mockRedis.keys).toHaveBeenCalledWith("cache:search:*");
    expect(mockRedis.del).toHaveBeenCalledWith("cache:search:a", "cache:search:b");
  });

  it("매칭 키가 없으면 del을 호출하지 않는다", async () => {
    mockRedis.keys.mockResolvedValue([]);
    await cacheInvalidate("cache:nope:");
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it("Redis 오류 시 예외를 전파하지 않는다", async () => {
    mockRedis.keys.mockRejectedValue(new Error("timeout"));
    await expect(cacheInvalidate("prefix:")).resolves.toBeUndefined();
  });
});

describe("cacheGetOrSet", () => {
  it("캐시 히트 시 fetcher를 호출하지 않는다", async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify("cached-val"));
    const fetcher = vi.fn().mockResolvedValue("fresh-val");
    const result = await cacheGetOrSet("k", 60, fetcher);
    expect(result).toBe("cached-val");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("캐시 미스 시 fetcher를 호출하고 결과를 캐시에 저장한다", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    const fetcher = vi.fn().mockResolvedValue({ data: 42 });
    const result = await cacheGetOrSet("k", 120, fetcher);
    expect(result).toEqual({ data: 42 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockRedis.set).toHaveBeenCalledWith("k", '{"data":42}', "EX", 120);
  });
});

describe("buildSearchCacheKey", () => {
  it("동일 파라미터에 대해 동일 키를 생성한다", () => {
    const k1 = buildSearchCacheKey({ a: 1, b: "x" });
    const k2 = buildSearchCacheKey({ a: 1, b: "x" });
    expect(k1).toBe(k2);
  });

  it("다른 파라미터에 대해 다른 키를 생성한다", () => {
    const k1 = buildSearchCacheKey({ a: 1 });
    const k2 = buildSearchCacheKey({ a: 2 });
    expect(k1).not.toBe(k2);
  });

  it("SEARCH 프리픽스로 시작한다", () => {
    const key = buildSearchCacheKey({ q: "test" });
    expect(key.startsWith(CACHE_PREFIX.SEARCH)).toBe(true);
  });

  it("키 순서가 달라도 동일 키를 생성한다", () => {
    const k1 = buildSearchCacheKey({ b: 2, a: 1 });
    const k2 = buildSearchCacheKey({ a: 1, b: 2 });
    expect(k1).toBe(k2);
  });
});

describe("CACHE_TTL 상수", () => {
  it("정의된 TTL 값이 올바르다", () => {
    expect(CACHE_TTL.SEARCH_RESULTS).toBe(30);
    expect(CACHE_TTL.QUALITY_METRICS).toBe(60);
    expect(CACHE_TTL.SKILL_GRAPH).toBe(300);
    expect(CACHE_TTL.SKILL_LIST).toBe(120);
    expect(CACHE_TTL.SIMILAR_ITEMS).toBe(300);
  });
});
