// 검색 tRPC 라우터
// Meilisearch(전문 검색) + PostgreSQL(구조 필터링, 전체 데이터 조회) 결합
// Redis 캐싱으로 빈번한 쿼리 성능 최적화 (Phase 10)
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  searchItemsSchema,
  searchSimilarSchema,
  similarFeedbackSchema,
} from "@math-item-os/shared/validators/index";
import type { SearchFacets, SearchResultItem } from "@math-item-os/shared/types/index";
import { searchItems } from "../services/meilisearch.service";
import { findSimilarItems } from "../services/similarity.service";
import type { SimilarItemResult } from "../services/similarity.service";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import {
  cacheGetOrSet,
  buildSearchCacheKey,
  CACHE_TTL,
  CACHE_PREFIX,
} from "../services/cache.service";

// MVP 단계에서 사용할 기본 조직 ID
const DEFAULT_ORG_ID = "default-org";

/** 사용자의 조직 ID를 반환한다. MVP에서는 고정값 사용. */
function getOrgId(): string {
  return DEFAULT_ORG_ID;
}

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

const SEARCH_ITEM_INCLUDE = {
  skills: { include: { skill: true } },
  standards: { include: { standard: true } },
  misconceptions: { include: { misconception: true } },
  difficultyProfile: true,
} satisfies Prisma.ItemInclude;

// -------------------------------------------------
// 검색 결과 응답 타입
// -------------------------------------------------

interface SearchItemsResponse {
  readonly items: SearchResultItem[];
  readonly total: number;
  readonly page: number;
  readonly facets: SearchFacets;
  readonly queryTime: number;
}

// -------------------------------------------------
// 역할 기반 상태 필터 적용
// -------------------------------------------------

/**
 * 교사 역할인 경우 approved 상태만 조회할 수 있도록
 * 상태 필터를 적용한다.
 */
function applyRoleStatusFilter(
  userRole: string,
  inputStatus?: string[],
): string[] | undefined {
  if (userRole === "teacher") {
    return ["approved"];
  }
  // 검수자/관리자: 입력된 상태 필터 그대로 사용 (없으면 전체)
  return inputStatus;
}

// -------------------------------------------------
// Meilisearch 검색 후 PostgreSQL에서 전체 데이터 조회
// -------------------------------------------------

async function fetchItemsByMeilisearch(
  input: {
    readonly query?: string;
    readonly filters?: {
      readonly subject?: string;
      readonly schoolLevel?: string;
      readonly grade?: number;
      readonly semester?: string;
      readonly skillIds?: string[];
      readonly standardIds?: string[];
      readonly itemType?: string;
      readonly codeLanguage?: string;
      readonly difficultyMin?: number;
      readonly difficultyMax?: number;
      readonly usagePurposes?: string[];
      readonly isGenerated?: boolean;
      readonly status?: string[];
    };
    readonly page: number;
    readonly limit: number;
    readonly sort?: "relevance" | "difficulty" | "createdAt";
  },
  orgId: string,
): Promise<SearchItemsResponse> {
  const startTime = Date.now();

  // 1. Meilisearch 검색
  const searchResult = await searchItems({
    query: input.query,
    filters: input.filters,
    page: input.page,
    limit: input.limit,
    sort: input.sort,
  });

  const { hitIds, total, facets } = searchResult;

  // 검색 결과가 없으면 빈 배열 반환
  if (hitIds.length === 0) {
    return {
      items: [],
      total,
      page: input.page,
      facets,
      queryTime: Date.now() - startTime,
    };
  }

  // 2. PostgreSQL에서 전체 데이터 조회
  const dbItems = await prisma.item.findMany({
    where: {
      id: { in: hitIds },
      orgId,
    },
    include: SEARCH_ITEM_INCLUDE,
  });

  // 3. Meilisearch 관련도 순서 복원 + 삭제된 항목 필터링
  const orderMap = new Map(hitIds.map((id, i) => [id, i]));
  const sortedItems = [...dbItems].sort(
    (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
  );

  // 4. SearchResultItem 변환
  const items: SearchResultItem[] = sortedItems.map((item) => ({
    ...item,
    choices: item.choices as unknown as SearchResultItem["choices"],
    answer: item.answer as unknown as SearchResultItem["answer"],
    metadata: item.metadata as unknown as SearchResultItem["metadata"],
    difficultyAuthor: item.difficultyAuthor,
  }));

  return {
    items,
    total,
    page: input.page,
    facets,
    queryTime: Date.now() - startTime,
  };
}

// -------------------------------------------------
// Prisma-only 폴백 (텍스트 쿼리 없는 경우)
// -------------------------------------------------

async function fetchItemsByPrisma(
  input: {
    readonly page: number;
    readonly limit: number;
    readonly sort?: "relevance" | "difficulty" | "createdAt";
    readonly statusFilter?: string[];
    readonly filters?: {
      readonly subject?: string;
      readonly difficultyMin?: number;
      readonly difficultyMax?: number;
      readonly schoolLevel?: string;
      readonly grade?: number;
      readonly itemType?: string;
      readonly codeLanguage?: string;
      readonly skillIds?: string[];
      readonly isGenerated?: boolean;
      readonly typeLevel?: number;
    };
  },
  orgId: string,
): Promise<SearchItemsResponse> {
  const startTime = Date.now();
  const f = input.filters;

  const where: Prisma.ItemWhereInput = {
    orgId,
    ...(input.statusFilter != null &&
      input.statusFilter.length > 0 && {
        status: { in: input.statusFilter as Prisma.EnumQualityStatusFilter["in"] },
      }),
    ...(f?.subject != null && { subject: f.subject as any }),
    ...(f?.difficultyMin != null || f?.difficultyMax != null
      ? {
          difficultyAuthor: {
            not: null,
            ...(f?.difficultyMin != null && { gte: f.difficultyMin }),
            ...(f?.difficultyMax != null && { lte: f.difficultyMax }),
          },
        }
      : {}),
    ...(f?.schoolLevel != null && { schoolLevel: f.schoolLevel as any }),
    ...(f?.grade != null && { grade: f.grade }),
    ...(f?.itemType != null && { itemType: f.itemType as any }),
    ...(f?.codeLanguage != null && { codeLanguage: f.codeLanguage as any }),
    ...(f?.isGenerated != null && { isGenerated: f.isGenerated }),
    ...(f?.skillIds != null && f.skillIds.length > 0 && {
      skills: { some: { skillId: { in: f.skillIds } } },
    }),
    ...(f?.typeLevel !== undefined && {
      skills: { some: { skill: { typeLevel: f.typeLevel } } },
    }),
  };

  // 정렬 규칙 결정
  const orderBy = buildPrismaOrderBy(input.sort);

  const [dbItems, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: SEARCH_ITEM_INCLUDE,
      orderBy,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.item.count({ where }),
  ]);

  // 패싯 데이터 별도 집계 (Prisma groupBy 사용)
  const facets = await buildPrismaFacets(orgId, input.statusFilter);

  const items: SearchResultItem[] = dbItems.map((item) => ({
    ...item,
    choices: item.choices as unknown as SearchResultItem["choices"],
    answer: item.answer as unknown as SearchResultItem["answer"],
    metadata: item.metadata as unknown as SearchResultItem["metadata"],
    difficultyAuthor: item.difficultyAuthor,
  }));

  return {
    items,
    total,
    page: input.page,
    facets,
    queryTime: Date.now() - startTime,
  };
}

// -------------------------------------------------
// Prisma 정렬 규칙 생성
// -------------------------------------------------

function buildPrismaOrderBy(
  sort?: "relevance" | "difficulty" | "createdAt",
): Prisma.ItemOrderByWithRelationInput {
  switch (sort) {
    case "difficulty":
      return { difficultyAuthor: "asc" };
    case "createdAt":
      return { createdAt: "desc" };
    case "relevance":
    default:
      return { createdAt: "desc" };
  }
}

// -------------------------------------------------
// Prisma 패싯 집계
// -------------------------------------------------

async function buildPrismaFacets(
  orgId: string,
  statusFilter?: string[],
): Promise<SearchFacets> {
  const baseWhere: Prisma.ItemWhereInput = {
    orgId,
    ...(statusFilter != null &&
      statusFilter.length > 0 && {
        status: { in: statusFilter as Prisma.EnumQualityStatusFilter["in"] },
      }),
  };

  const [subjectGroups, schoolLevelGroups, gradeGroups, itemTypeGroups, codeLanguageGroups, difficultyGroups] =
    await Promise.all([
      prisma.item.groupBy({
        by: ["subject"],
        where: baseWhere,
        _count: true,
      }),
      prisma.item.groupBy({
        by: ["schoolLevel"],
        where: baseWhere,
        _count: true,
      }),
      prisma.item.groupBy({
        by: ["grade"],
        where: baseWhere,
        _count: true,
      }),
      prisma.item.groupBy({
        by: ["itemType"],
        where: baseWhere,
        _count: true,
      }),
      prisma.item.groupBy({
        by: ["codeLanguage"],
        where: { ...baseWhere, codeLanguage: { not: null } },
        _count: true,
      }),
      prisma.item.groupBy({
        by: ["difficultyAuthor"],
        where: { ...baseWhere, difficultyAuthor: { not: null } },
        _count: true,
      }),
    ]);

  const schoolLevel: Record<string, number> = {};
  for (const g of schoolLevelGroups) {
    schoolLevel[g.schoolLevel] = g._count;
  }

  const grade: Record<number, number> = {};
  for (const g of gradeGroups) {
    grade[g.grade] = g._count;
  }

  const itemType: Record<string, number> = {};
  for (const g of itemTypeGroups) {
    itemType[g.itemType] = g._count;
  }

  const difficulty: Record<number, number> = {};
  for (const g of difficultyGroups) {
    if (g.difficultyAuthor != null) {
      difficulty[g.difficultyAuthor] = g._count;
    }
  }

  const subject: Record<string, number> = {};
  for (const g of subjectGroups) {
    subject[g.subject] = g._count;
  }

  const codeLanguage: Record<string, number> = {};
  for (const g of codeLanguageGroups) {
    if (g.codeLanguage != null) {
      codeLanguage[g.codeLanguage] = g._count;
    }
  }

  return { subject, schoolLevel, grade, itemType, codeLanguage, difficulty };
}

// -------------------------------------------------
// 빈 쿼리/필터 여부 판별
// -------------------------------------------------

function hasSearchCriteria(input: {
  readonly query?: string;
  readonly filters?: Record<string, unknown>;
}): boolean {
  if (input.query != null && input.query.trim().length > 0) {
    return true;
  }
  if (input.filters == null) {
    return false;
  }
  return Object.values(input.filters).some((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

// -------------------------------------------------
// 라우터 정의
// -------------------------------------------------

export const searchRouter = createTRPCRouter({
  // 문항 검색 (Meilisearch + PostgreSQL)
  items: protectedProcedure
    .input(searchItemsSchema)
    .query(async ({ input, ctx }): Promise<SearchItemsResponse> => {
      const orgId = getOrgId();
      const userRole = ctx.user.role;

      // 역할 기반 상태 필터 적용
      const statusFilter = applyRoleStatusFilter(
        userRole,
        input.filters?.status,
      );

      // 텍스트 쿼리가 없으면 Prisma-only 폴백 (Meilisearch 인덱스 불필요)
      const hasTextQuery = input.query != null && input.query.trim().length > 0;
      if (!hasTextQuery) {
        return fetchItemsByPrisma(
          {
            page: input.page,
            limit: input.limit,
            sort: input.sort,
            statusFilter,
            filters: input.filters,
          },
          orgId,
        );
      }

      // Meilisearch 검색 + PostgreSQL 전체 데이터 조회 (Redis 캐싱)
      const filtersWithStatus = {
        ...input.filters,
        status: statusFilter,
      };

      const searchParams = {
        query: input.query,
        filters: filtersWithStatus,
        page: input.page,
        limit: input.limit,
        sort: input.sort,
      };

      const cacheKey = buildSearchCacheKey(searchParams);

      return cacheGetOrSet(
        cacheKey,
        CACHE_TTL.SEARCH_RESULTS,
        () => fetchItemsByMeilisearch(searchParams, orgId),
      );
    }),

  // 구조적 유사 문항 검색 (6-시그널 랭킹, Redis 캐싱)
  similar: protectedProcedure
    .input(searchSimilarSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      const cacheKey = `${CACHE_PREFIX.SIMILAR}${input.itemId}:${input.limit}`;

      return cacheGetOrSet(cacheKey, CACHE_TTL.SIMILAR_ITEMS, async () => {
      const results = await findSimilarItems(input.itemId, orgId, input.limit);

      // 각 결과에 대해 문항 전체 데이터를 조회하여 응답 구성
      if (results.length === 0) {
        return { items: [] };
      }

      const itemIds = results.map((r: SimilarItemResult) => r.itemId);
      const dbItems = await prisma.item.findMany({
        where: { id: { in: itemIds }, orgId },
        include: SEARCH_ITEM_INCLUDE,
      });

      const itemMap = new Map(dbItems.map((item) => [item.id, item]));

      const items = results
        .map((r: SimilarItemResult) => {
          const item = itemMap.get(r.itemId);
          if (item == null) return null;
          return {
            item: {
              ...item,
              choices: item.choices as unknown as SearchResultItem["choices"],
              answer: item.answer as unknown as SearchResultItem["answer"],
              metadata: item.metadata as unknown as SearchResultItem["metadata"],
            },
            score: r.score,
            signals: r.signals,
            explanation: r.explanation,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      return { items };
      }); // end cacheGetOrSet
    }),

  // 유사도 피드백 기록 (RecommendationEvent)
  similarFeedback: protectedProcedure
    .input(similarFeedbackSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      const userId = ctx.user.id;

      await prisma.recommendationEvent.create({
        data: {
          orgId,
          recType: "practice",
          itemIds: [input.sourceItemId, input.targetItemId],
          reasoning: {
            type: "similarity_feedback",
            sourceItemId: input.sourceItemId,
            targetItemId: input.targetItemId,
            relevant: input.relevant,
            userId,
          },
          accepted: input.relevant,
        },
      });

      return { success: true };
    }),
});
