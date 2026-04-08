"use client";

import { useState, useCallback, useMemo } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { FilterPanel, INITIAL_SEARCH_FILTERS } from "@/components/search/filter-panel";
import type { SearchFilters } from "@/components/search/filter-panel";
import { SearchResults } from "@/components/search/search-results";
import { trpc } from "@/lib/trpc";
import { PageHelp } from "@/components/help/page-help";

// --- 상수 ---

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const SORT_OPTIONS = [
  { value: "relevance", label: "관련도" },
  { value: "createdAt", label: "최신순" },
  { value: "difficulty", label: "난이도" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// --- 메인 페이지 ---

export default function SearchPage() {
  // -- 상태 --
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_SEARCH_FILTERS);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [sort, setSort] = useState<SortValue>("relevance");

  // -- tRPC 쿼리 입력값 구성 --
  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = {
      page,
      limit: DEFAULT_LIMIT,
      sort,
    };

    if (query.trim()) {
      input.query = query.trim();
    }

    // 필터 객체 구성
    const filterObj: Record<string, unknown> = {};
    if (filters.schoolLevel) filterObj.schoolLevel = filters.schoolLevel;
    if (filters.grade) filterObj.grade = Number(filters.grade);
    if (filters.itemType) filterObj.itemType = filters.itemType;
    if (filters.difficultyMin) filterObj.difficultyMin = Number(filters.difficultyMin);
    if (filters.difficultyMax) filterObj.difficultyMax = Number(filters.difficultyMax);
    if (filters.usagePurpose) filterObj.usagePurposes = [filters.usagePurpose];

    if (Object.keys(filterObj).length > 0) {
      input.filters = filterObj;
    }

    return input;
  }, [query, filters, page, sort]);

  // -- tRPC 검색 쿼리 --
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = trpc.search.items.useQuery(queryInput as any);

  // -- 핸들러 --
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleQuerySubmit = useCallback((value: string) => {
    setQuery(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof SearchFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(DEFAULT_PAGE);
    },
    [],
  );

  const handleFilterReset = useCallback(() => {
    setFilters(INITIAL_SEARCH_FILTERS);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleSortChange = useCallback((value: SortValue) => {
    setSort(value);
    setPage(DEFAULT_PAGE);
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">문항 검색</h1>
        <PageHelp pageId="search" />
      </div>

      {/* 검색바 */}
      <div className="mb-4">
        <SearchBar
          value={query}
          onChange={handleQueryChange}
          onSubmit={handleQuerySubmit}
          isLoading={isLoading}
        />
      </div>

      {/* 필터 + 정렬 */}
      <div className="mb-6 flex flex-col gap-3">
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleFilterReset}
          facets={data?.facets}
        />

        {/* 정렬 옵션 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">정렬:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              aria-pressed={sort === opt.value}
              className={`rounded-full px-3 py-1 text-xs ${
                sort === opt.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 결과 */}
      <SearchResults
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={DEFAULT_LIMIT}
        queryTime={data?.queryTime}
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </div>
  );
}
