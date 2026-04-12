// meilisearch.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Meilisearch 클라이언트 모킹
// ─────────────────────────────────────────────

const mockIndex = {
  updateSettings: vi.fn().mockResolvedValue({}),
  addDocuments: vi.fn().mockResolvedValue({ taskUid: 1 }),
  deleteDocument: vi.fn().mockResolvedValue({ taskUid: 2 }),
  search: vi.fn(),
};

const mockClient = {
  index: vi.fn().mockReturnValue(mockIndex),
};

vi.mock("meilisearch", () => {
  const MeilisearchClass = function () {
    return mockClient;
  };
  return { Meilisearch: MeilisearchClass };
});

import { TRPCError } from "@trpc/server";
import {
  initializeIndex,
  toMeilisearchDocument,
  indexItem,
  deleteItemFromIndex,
  indexItemsBatch,
  searchItems,
  type ItemWithRelations,
  type SearchParams,
} from "../meilisearch.service";

// ─────────────────────────────────────────────
// 테스트 데이터
// ─────────────────────────────────────────────

function makeItem(overrides: Partial<ItemWithRelations> = {}): ItemWithRelations {
  return {
    id: "item-1",
    bodyLatex: "x + 1 = 2",
    bodyHtml: "<p>x + 1 = 2</p>",
    schoolLevel: "middle",
    grade: 7,
    semester: "1",
    itemType: "short_answer",
    difficultyAuthor: 3,
    status: "draft",
    usagePurposes: ["diagnosis"],
    isGenerated: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    skills: [{ skill: { id: "sk-1", title: "일차방정식" } }],
    standards: [{ standard: { id: "st-1", title: "수와 연산" } }],
    misconceptions: [{ misconception: { id: "mc-1", title: "등호 오해" } }],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("initializeIndex", () => {
  it("인덱스 설정을 업데이트한다", async () => {
    await initializeIndex();

    expect(mockClient.index).toHaveBeenCalledWith("items");
    expect(mockIndex.updateSettings).toHaveBeenCalledTimes(1);

    const settings = mockIndex.updateSettings.mock.calls[0][0];
    expect(settings.searchableAttributes).toContain("bodyLatex");
    expect(settings.filterableAttributes).toContain("schoolLevel");
    expect(settings.sortableAttributes).toContain("createdAt");
  });
});

describe("toMeilisearchDocument", () => {
  it("ItemWithRelations를 MeilisearchItemDocument로 변환한다", () => {
    const item = makeItem();
    const doc = toMeilisearchDocument(item);

    expect(doc.id).toBe("item-1");
    expect(doc.bodyLatex).toBe("x + 1 = 2");
    expect(doc.skillIds).toEqual(["sk-1"]);
    expect(doc.skillTitles).toEqual(["일차방정식"]);
    expect(doc.standardIds).toEqual(["st-1"]);
    expect(doc.standardTitles).toEqual(["수와 연산"]);
    expect(doc.misconceptionTitles).toEqual(["등호 오해"]);
    expect(doc.createdAt).toBe(Math.floor(new Date("2025-01-01T00:00:00Z").getTime() / 1000));
  });

  it("relations가 없으면 빈 배열로 변환한다", () => {
    const item = makeItem({ skills: undefined, standards: undefined, misconceptions: undefined });
    const doc = toMeilisearchDocument(item);

    expect(doc.skillIds).toEqual([]);
    expect(doc.skillTitles).toEqual([]);
    expect(doc.standardIds).toEqual([]);
    expect(doc.standardTitles).toEqual([]);
    expect(doc.misconceptionTitles).toEqual([]);
  });

  it("usagePurposes를 새 배열로 복사한다", () => {
    const item = makeItem({ usagePurposes: ["diagnosis", "pre_exam"] });
    const doc = toMeilisearchDocument(item);
    expect(doc.usagePurposes).toEqual(["diagnosis", "pre_exam"]);
  });
});

describe("indexItem", () => {
  it("단건 인덱싱을 수행한다", async () => {
    const item = makeItem();
    await indexItem(item);

    expect(mockIndex.addDocuments).toHaveBeenCalledTimes(1);
    const docs = mockIndex.addDocuments.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe("item-1");
  });

  it("인덱싱 실패 시 예외를 throw하지 않고 경고한다", async () => {
    mockIndex.addDocuments.mockRejectedValueOnce(new Error("connection refused"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(indexItem(makeItem())).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("deleteItemFromIndex", () => {
  it("인덱스에서 문서를 삭제한다", async () => {
    await deleteItemFromIndex("item-1");

    expect(mockIndex.deleteDocument).toHaveBeenCalledWith("item-1");
  });

  it("삭제 실패 시 예외를 throw하지 않고 경고한다", async () => {
    mockIndex.deleteDocument.mockRejectedValueOnce(new Error("not found"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(deleteItemFromIndex("item-1")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("indexItemsBatch", () => {
  it("배치 인덱싱을 수행한다", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    await indexItemsBatch(items);

    expect(mockIndex.addDocuments).toHaveBeenCalledTimes(1);
    const docs = mockIndex.addDocuments.mock.calls[0][0];
    expect(docs).toHaveLength(2);
  });

  it("배치 인덱싱 실패 시 예외를 throw하지 않고 경고한다", async () => {
    mockIndex.addDocuments.mockRejectedValueOnce(new Error("timeout"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(indexItemsBatch([makeItem()])).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("searchItems", () => {
  const baseSearchResponse = {
    hits: [{ id: "item-1" }, { id: "item-2" }],
    totalHits: 2,
    processingTimeMs: 5,
    facetDistribution: {
      schoolLevel: { middle: 1, high: 1 },
      grade: { "7": 1, "10": 1 },
      itemType: { short_answer: 2 },
      difficultyAuthor: { "3": 1, "4": 1 },
    },
  };

  beforeEach(() => {
    mockIndex.search.mockResolvedValue(baseSearchResponse);
  });

  it("기본 검색을 수행한다", async () => {
    const result = await searchItems({ query: "방정식" });

    expect(mockIndex.search).toHaveBeenCalledWith("방정식", expect.objectContaining({
      hitsPerPage: 20,
      page: 1,
    }));
    expect(result.hitIds).toEqual(["item-1", "item-2"]);
    expect(result.total).toBe(2);
    expect(result.queryTimeMs).toBe(5);
  });

  it("필터를 적용하여 검색한다", async () => {
    await searchItems({
      query: "",
      filters: {
        schoolLevel: "middle",
        grade: 7,
        itemType: "short_answer",
        difficultyMin: 1,
        difficultyMax: 5,
        isGenerated: false,
        skillIds: ["sk-1"],
        standardIds: ["st-1"],
        usagePurposes: ["diagnosis"],
        status: ["draft", "approved"],
        semester: "1",
      },
    });

    const searchCall = mockIndex.search.mock.calls[0];
    const opts = searchCall[1];
    expect(opts.filter).toBeDefined();
    expect(opts.filter).toContain('schoolLevel = "middle"');
    expect(opts.filter).toContain("grade = 7");
    expect(opts.filter).toContain("difficultyAuthor >= 1");
    expect(opts.filter).toContain("difficultyAuthor <= 5");
    expect(opts.filter).toContain("isGenerated = false");
    expect(opts.filter).toContain('skillIds IN ["sk-1"]');
    expect(opts.filter).toContain('standardIds IN ["st-1"]');
    expect(opts.filter).toContain('usagePurposes IN ["diagnosis"]');
    expect(opts.filter).toContain('status IN ["draft", "approved"]');
    expect(opts.filter).toContain('semester = "1"');
  });

  it("정렬 옵션을 적용한다 — difficulty", async () => {
    await searchItems({ sort: "difficulty" });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.sort).toEqual(["difficultyAuthor:asc"]);
  });

  it("정렬 옵션을 적용한다 — createdAt", async () => {
    await searchItems({ sort: "createdAt" });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.sort).toEqual(["createdAt:desc"]);
  });

  it("정렬 옵션 — relevance는 sort를 보내지 않는다", async () => {
    await searchItems({ sort: "relevance" });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.sort).toBeUndefined();
  });

  it("facets의 숫자 키를 숫자 타입으로 변환한다", async () => {
    const result = await searchItems({});
    expect(result.facets.grade).toEqual({ 7: 1, 10: 1 });
    expect(result.facets.difficulty).toEqual({ 3: 1, 4: 1 });
  });

  it("facetDistribution이 없으면 빈 객체를 반환한다", async () => {
    mockIndex.search.mockResolvedValueOnce({
      hits: [],
      totalHits: 0,
      processingTimeMs: 1,
      facetDistribution: undefined,
    });

    const result = await searchItems({});
    expect(result.facets.schoolLevel).toEqual({});
    expect(result.facets.grade).toEqual({});
  });

  it("검색 실패 시 TRPCError를 throw한다", async () => {
    mockIndex.search.mockRejectedValueOnce(new Error("index not found"));

    await expect(searchItems({ query: "test" })).rejects.toThrow(TRPCError);
  });

  it("필터가 없으면 빈 필터 문자열을 사용한다", async () => {
    await searchItems({ query: "test" });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.filter).toBeUndefined();
  });

  it("특수 문자가 포함된 필터 값을 이스케이프한다", async () => {
    await searchItems({
      filters: { schoolLevel: 'mid"dle' },
    });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.filter).toContain('schoolLevel = "mid\\"dle"');
  });

  it("페이지와 limit을 전달한다", async () => {
    await searchItems({ page: 3, limit: 10 });

    const opts = mockIndex.search.mock.calls[0][1];
    expect(opts.page).toBe(3);
    expect(opts.hitsPerPage).toBe(10);
  });
});
