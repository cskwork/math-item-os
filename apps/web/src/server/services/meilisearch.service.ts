// Meilisearch 동기화 서비스
// 수학 문항의 CRUD 시 Meilisearch 인덱스와 동기화하고, 한국어 전문 검색을 제공한다.
import { TRPCError } from "@trpc/server";
import { Meilisearch } from "meilisearch";

// -------------------------------------------------
// 상수 정의
// -------------------------------------------------

const INDEX_NAME = "items";

const SEARCHABLE_ATTRIBUTES = [
  "bodyLatex",
  "bodyHtml",
  "skillTitles",
  "standardTitles",
  "misconceptionTitles",
] as const;

const FILTERABLE_ATTRIBUTES = [
  "schoolLevel",
  "grade",
  "semester",
  "itemType",
  "difficultyAuthor",
  "status",
  "usagePurposes",
  "isGenerated",
  "skillIds",
  "standardIds",
] as const;

const SORTABLE_ATTRIBUTES = [
  "difficultyAuthor",
  "createdAt",
  "grade",
] as const;

const FACET_ATTRIBUTES = [
  "schoolLevel",
  "grade",
  "itemType",
  "difficultyAuthor",
] as const;

// -------------------------------------------------
// Meilisearch 클라이언트 (lazy singleton)
// -------------------------------------------------

let clientInstance: Meilisearch | null = null;

function getClient(): Meilisearch {
  if (clientInstance != null) {
    return clientInstance;
  }

  const host = process.env.MEILISEARCH_HOST ?? "http://localhost:7700";
  const apiKey = process.env.MEILISEARCH_MASTER_KEY;

  clientInstance = new Meilisearch({
    host,
    apiKey,
  });

  return clientInstance;
}

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

/** Meilisearch 인덱스에 저장될 문서 형태 */
export interface MeilisearchItemDocument {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodyHtml: string | null;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly semester: string | null;
  readonly itemType: string;
  readonly difficultyAuthor: number | null;
  readonly status: string;
  readonly usagePurposes: string[];
  readonly isGenerated: boolean;
  readonly skillIds: string[];
  readonly skillTitles: string[];
  readonly standardIds: string[];
  readonly standardTitles: string[];
  readonly misconceptionTitles: string[];
  readonly createdAt: number; // unix timestamp (정렬용)
}

/** Prisma Item + relations 타입 (서비스에서 사용하는 최소 필드) */
export interface ItemWithRelations {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodyHtml: string | null;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly semester: string | null;
  readonly itemType: string;
  readonly difficultyAuthor: number | null;
  readonly status: string;
  readonly usagePurposes: string[];
  readonly isGenerated: boolean;
  readonly createdAt: Date;
  readonly skills?: ReadonlyArray<{ skill: { id: string; title: string } }>;
  readonly standards?: ReadonlyArray<{
    standard: { id: string; title: string };
  }>;
  readonly misconceptions?: ReadonlyArray<{
    misconception: { id: string; title: string };
  }>;
}

/** 검색 파라미터 */
export interface SearchParams {
  readonly query?: string;
  readonly filters?: {
    readonly schoolLevel?: string;
    readonly grade?: number;
    readonly semester?: string;
    readonly skillIds?: string[];
    readonly standardIds?: string[];
    readonly itemType?: string;
    readonly difficultyMin?: number;
    readonly difficultyMax?: number;
    readonly usagePurposes?: string[];
    readonly isGenerated?: boolean;
    readonly status?: string[];
  };
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: "relevance" | "difficulty" | "createdAt";
}

/** 검색 결과 */
export interface SearchResult {
  readonly hitIds: string[];
  readonly total: number;
  readonly facets: {
    readonly schoolLevel: Record<string, number>;
    readonly grade: Record<number, number>;
    readonly itemType: Record<string, number>;
    readonly difficulty: Record<number, number>;
  };
  readonly queryTimeMs: number;
}

// -------------------------------------------------
// 인덱스 설정 초기화 (앱 시작 시 1회 호출)
// -------------------------------------------------

export async function initializeIndex(): Promise<void> {
  const client = getClient();
  const index = client.index(INDEX_NAME);

  // CJK(한국어) 토크나이저를 위한 localizedAttributes 포함
  await index.updateSettings({
    searchableAttributes: [...SEARCHABLE_ATTRIBUTES],
    filterableAttributes: [...FILTERABLE_ATTRIBUTES],
    sortableAttributes: [...SORTABLE_ATTRIBUTES],
    pagination: {
      maxTotalHits: 10_000,
    },
    localizedAttributes: [
      {
        attributePatterns: [
          "bodyLatex",
          "bodyHtml",
          "skillTitles",
          "standardTitles",
          "misconceptionTitles",
        ],
        locales: ["kor"],
      },
    ],
  });
}

// -------------------------------------------------
// Prisma Item -> MeilisearchItemDocument 변환
// -------------------------------------------------

export function toMeilisearchDocument(
  item: ItemWithRelations,
): MeilisearchItemDocument {
  return {
    id: item.id,
    bodyLatex: item.bodyLatex,
    bodyHtml: item.bodyHtml,
    schoolLevel: item.schoolLevel,
    grade: item.grade,
    semester: item.semester,
    itemType: item.itemType,
    difficultyAuthor: item.difficultyAuthor,
    status: item.status,
    usagePurposes: [...item.usagePurposes],
    isGenerated: item.isGenerated,
    skillIds: (item.skills ?? []).map((s) => s.skill.id),
    skillTitles: (item.skills ?? []).map((s) => s.skill.title),
    standardIds: (item.standards ?? []).map((s) => s.standard.id),
    standardTitles: (item.standards ?? []).map((s) => s.standard.title),
    misconceptionTitles: (item.misconceptions ?? []).map(
      (m) => m.misconception.title,
    ),
    createdAt: Math.floor(item.createdAt.getTime() / 1000),
  };
}

// -------------------------------------------------
// 단건 인덱싱 (생성/수정 시)
// -------------------------------------------------

export async function indexItem(item: ItemWithRelations): Promise<void> {
  try {
    const client = getClient();
    const index = client.index<MeilisearchItemDocument>(INDEX_NAME);
    const document = toMeilisearchDocument(item);
    await index.addDocuments([document]);
  } catch (error: unknown) {
    console.warn(
      "[Meilisearch] 단건 인덱싱 실패 - 서비스 미연결 또는 오류:",
      error instanceof Error ? error.message : error,
    );
  }
}

// -------------------------------------------------
// 단건 삭제 (삭제 시)
// -------------------------------------------------

export async function deleteItemFromIndex(itemId: string): Promise<void> {
  try {
    const client = getClient();
    const index = client.index<MeilisearchItemDocument>(INDEX_NAME);
    await index.deleteDocument(itemId);
  } catch (error: unknown) {
    console.warn(
      "[Meilisearch] 인덱스 삭제 실패 - 서비스 미연결 또는 오류:",
      error instanceof Error ? error.message : error,
    );
  }
}

// -------------------------------------------------
// 배치 인덱싱 (대량 업로드 시)
// -------------------------------------------------

export async function indexItemsBatch(
  items: ReadonlyArray<ItemWithRelations>,
): Promise<void> {
  try {
    const client = getClient();
    const index = client.index<MeilisearchItemDocument>(INDEX_NAME);
    const documents = items.map(toMeilisearchDocument);
    await index.addDocuments(documents);
  } catch (error: unknown) {
    console.warn(
      "[Meilisearch] 배치 인덱싱 실패 - 서비스 미연결 또는 오류:",
      error instanceof Error ? error.message : error,
    );
  }
}

// -------------------------------------------------
// 검색 수행
// -------------------------------------------------

export async function searchItems(params: SearchParams): Promise<SearchResult> {
  const {
    query,
    filters,
    page = 1,
    limit = 20,
    sort = "relevance",
  } = params;

  const filterString = buildFilterString(filters);
  const sortRules = buildSortRules(sort);

  try {
    const client = getClient();
    const index = client.index<MeilisearchItemDocument>(INDEX_NAME);

    const response = await index.search(query ?? "", {
      filter: filterString.length > 0 ? filterString : undefined,
      sort: sortRules.length > 0 ? sortRules : undefined,
      facets: [...FACET_ATTRIBUTES],
      hitsPerPage: limit,
      page,
    });

    const hitIds = response.hits.map((hit) => hit.id);
    const facetDistribution = response.facetDistribution ?? {};

    return {
      hitIds,
      total: response.totalHits ?? 0,
      facets: {
        schoolLevel: facetDistribution["schoolLevel"] ?? {},
        grade: toNumericKeyRecord(facetDistribution["grade"] ?? {}),
        itemType: facetDistribution["itemType"] ?? {},
        difficulty: toNumericKeyRecord(
          facetDistribution["difficultyAuthor"] ?? {},
        ),
      },
      queryTimeMs: response.processingTimeMs,
    };
  } catch (error: unknown) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Meilisearch 검색 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      cause: error,
    });
  }
}

// -------------------------------------------------
// 내부 유틸리티: 필터 문자열 생성
// -------------------------------------------------

function buildFilterString(
  filters?: SearchParams["filters"],
): string {
  if (filters == null) {
    return "";
  }

  const clauses: string[] = [];

  if (filters.schoolLevel != null) {
    clauses.push(`schoolLevel = "${escapeFilterValue(filters.schoolLevel)}"`);
  }

  if (filters.grade != null) {
    clauses.push(`grade = ${filters.grade}`);
  }

  if (filters.semester != null) {
    clauses.push(`semester = "${escapeFilterValue(filters.semester)}"`);
  }

  if (filters.itemType != null) {
    clauses.push(`itemType = "${escapeFilterValue(filters.itemType)}"`);
  }

  if (filters.difficultyMin != null) {
    clauses.push(`difficultyAuthor >= ${filters.difficultyMin}`);
  }

  if (filters.difficultyMax != null) {
    clauses.push(`difficultyAuthor <= ${filters.difficultyMax}`);
  }

  if (filters.isGenerated != null) {
    clauses.push(`isGenerated = ${filters.isGenerated}`);
  }

  if (filters.skillIds != null && filters.skillIds.length > 0) {
    const escaped = filters.skillIds.map(
      (id) => `"${escapeFilterValue(id)}"`,
    );
    clauses.push(`skillIds IN [${escaped.join(", ")}]`);
  }

  if (filters.standardIds != null && filters.standardIds.length > 0) {
    const escaped = filters.standardIds.map(
      (id) => `"${escapeFilterValue(id)}"`,
    );
    clauses.push(`standardIds IN [${escaped.join(", ")}]`);
  }

  if (filters.usagePurposes != null && filters.usagePurposes.length > 0) {
    const escaped = filters.usagePurposes.map(
      (p) => `"${escapeFilterValue(p)}"`,
    );
    clauses.push(`usagePurposes IN [${escaped.join(", ")}]`);
  }

  if (filters.status != null && filters.status.length > 0) {
    const escaped = filters.status.map(
      (s) => `"${escapeFilterValue(s)}"`,
    );
    clauses.push(`status IN [${escaped.join(", ")}]`);
  }

  return clauses.join(" AND ");
}

// -------------------------------------------------
// 내부 유틸리티: 정렬 규칙 생성
// -------------------------------------------------

function buildSortRules(sort: SearchParams["sort"]): string[] {
  switch (sort) {
    case "difficulty":
      return ["difficultyAuthor:asc"];
    case "createdAt":
      return ["createdAt:desc"];
    case "relevance":
    default:
      return [];
  }
}

// -------------------------------------------------
// 내부 유틸리티: 필터 값 이스케이프
// -------------------------------------------------

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// -------------------------------------------------
// 내부 유틸리티: facet 카운트의 문자열 키를 숫자 키로 변환
// -------------------------------------------------

function toNumericKeyRecord(
  record: Record<string, number>,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const numKey = Number(key);
    if (!Number.isNaN(numKey)) {
      result[numKey] = value;
    }
  }
  return result;
}
