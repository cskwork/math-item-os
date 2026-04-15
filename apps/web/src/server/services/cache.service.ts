// Redis 캐시 서비스 - 빈번한 쿼리 결과 캐싱
// 검색 결과, 품질 메트릭, 스킬 그래프 등 반복 호출되는 쿼리에 사용
import { Redis } from "ioredis";

// -------------------------------------------------
// 상수
// -------------------------------------------------

/** Redis 연결 URL */
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** 캐시 TTL (초) */
export const CACHE_TTL = {
  /** 검색 결과: 30초 (데이터 변경 빈도 고려) */
  SEARCH_RESULTS: 30,
  /** 품질 메트릭: 60초 (대시보드 갱신 주기) */
  QUALITY_METRICS: 60,
  /** 스킬 그래프: 5분 (구조 변경 드묾) */
  SKILL_GRAPH: 300,
  /** 스킬 목록: 2분 */
  SKILL_LIST: 120,
  /** 유사문항 결과: 5분 */
  SIMILAR_ITEMS: 300,
  /** 검색 패싯(집계): 2분 (데이터 변경 빈도 고려) */
  FACETS: 120,
} as const;

/** 캐시 키 프리픽스 */
export const CACHE_PREFIX = {
  SEARCH: "cache:search:",
  METRICS: "cache:metrics:",
  SKILL_GRAPH: "cache:skill-graph:",
  SIMILAR: "cache:similar:",
  FACETS: "cache:facets:",
} as const;

// -------------------------------------------------
// Redis 클라이언트 (lazy singleton)
// -------------------------------------------------

let clientInstance: Redis | null = null;

function getClient(): Redis {
  if (clientInstance != null) {
    return clientInstance;
  }

  clientInstance = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  clientInstance.on("error", () => {
    // Redis 연결 오류 시 캐시를 무시하고 원본 쿼리 수행
  });

  return clientInstance;
}

// -------------------------------------------------
// 캐시 읽기/쓰기
// -------------------------------------------------

/**
 * 캐시에서 값을 조회한다. 없거나 Redis 오류 시 null 반환.
 * JSON 파싱하여 타입 T로 반환.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getClient();
    const raw = await client.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 캐시에 값을 저장한다. TTL(초) 지정. 실패해도 예외 전파 안함.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const client = getClient();
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // fire-and-forget: 캐시 저장 실패는 무시
  }
}

/**
 * 특정 프리픽스의 캐시를 모두 무효화한다 (패턴 삭제).
 * 데이터 변경 시 관련 캐시를 무효화하는 데 사용.
 */
export async function cacheInvalidate(prefix: string): Promise<void> {
  try {
    const client = getClient();
    const keys = await client.keys(`${prefix}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // fire-and-forget
  }
}

/**
 * 캐시 조회 또는 생성 패턴.
 * 캐시에 있으면 반환, 없으면 fetcher를 실행하고 결과를 캐시에 저장.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached != null) return cached;

  const result = await fetcher();
  await cacheSet(key, result, ttlSeconds);
  return result;
}

/**
 * 검색 쿼리 파라미터로 캐시 키를 생성한다.
 * 동일한 검색 조건은 동일한 키를 생성한다.
 */
export function buildSearchCacheKey(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  // 간단한 해시 생성 (FNV-1a 변형)
  let hash = 2166136261;
  for (let i = 0; i < sorted.length; i++) {
    hash ^= sorted.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${CACHE_PREFIX.SEARCH}${(hash >>> 0).toString(36)}`;
}
