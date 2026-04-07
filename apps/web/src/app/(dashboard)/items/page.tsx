"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/items/item-card";
import { trpc } from "@/lib/trpc";
import type { Item } from "@math-item-os/shared/types/index";
import {
  QUALITY_STATUS_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
  ITEM_TYPE_OPTIONS,
  DIFFICULTY_LEVEL_OPTIONS,
} from "@math-item-os/shared/constants/index";

// --- 정렬 옵션 ---

const SORT_BY_OPTIONS = [
  { value: "createdAt", label: "생성일" },
  { value: "updatedAt", label: "수정일" },
  { value: "difficulty", label: "난이도" },
] as const;

const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "내림차순" },
  { value: "asc", label: "오름차순" },
] as const;

// --- 기본값 ---

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

// --- 필터 상태 타입 ---

type SortByValue = "createdAt" | "updatedAt" | "difficulty";
type SortOrderValue = "asc" | "desc";

interface Filters {
  readonly status: string;
  readonly schoolLevel: string;
  readonly itemType: string;
  readonly difficultyMin: string;
  readonly difficultyMax: string;
  readonly sortBy: SortByValue;
  readonly sortOrder: SortOrderValue;
}

const INITIAL_FILTERS: Filters = {
  status: "",
  schoolLevel: "",
  itemType: "",
  difficultyMin: "",
  difficultyMax: "",
  sortBy: "createdAt",
  sortOrder: "desc",
};

// --- 필터 셀렉트 컴포넌트 ---

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "전체",
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  placeholder?: string;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- 로딩 스켈레톤 ---

function ItemCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-12 rounded-full bg-slate-200" />
        <div className="h-4 w-8 rounded bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-3/4 rounded bg-slate-200" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-10 rounded bg-slate-200" />
        <div className="h-5 w-14 rounded bg-slate-200" />
        <div className="h-5 w-16 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: DEFAULT_LIMIT }, (_, i) => (
        <ItemCardSkeleton key={i} />
      ))}
    </div>
  );
}

// --- 빈 상태 ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
      <p className="text-sm text-slate-500">등록된 문항이 없습니다</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link href={"/items/new" as any} className="mt-3">
        <Button variant="outline" size="sm">
          문항 등록하기
        </Button>
      </Link>
    </div>
  );
}

// --- 에러 상태 ---

function ErrorState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

// --- 페이지네이션 ---

function Pagination({
  page,
  totalPages,
  onPageChange,
}: Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}>) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      <span className="text-sm text-slate-600">
        {page} / {totalPages} 페이지
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}

// --- 메인 페이지 ---

export default function ItemListPage() {
  const router = useRouter();

  // -- 필터 상태 --
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(DEFAULT_PAGE);

  // -- 필터 변경 핸들러 (페이지 초기화 포함) --
  const handleFilterChange = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(DEFAULT_PAGE);
    },
    [],
  );

  // -- tRPC 쿼리 입력값 구성 --
  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = {
      page,
      limit: DEFAULT_LIMIT,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    // 상태 필터 (단일 선택을 배열로 변환)
    if (filters.status) {
      input.status = [filters.status];
    }

    if (filters.schoolLevel) {
      input.schoolLevel = filters.schoolLevel;
    }

    if (filters.itemType) {
      input.itemType = filters.itemType;
    }

    if (filters.difficultyMin) {
      input.difficultyMin = Number(filters.difficultyMin);
    }

    if (filters.difficultyMax) {
      input.difficultyMax = Number(filters.difficultyMax);
    }

    return input;
  }, [filters, page]);

  // -- 문항 목록 조회 --
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, isError, error } = trpc.item.list.useQuery(queryInput as any);

  // -- 카드 클릭 핸들러 --
  const handleCardClick = useCallback(
    (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/items/${id}` as any);
    },
    [router],
  );

  // -- 전체 페이지 수 계산 --
  const totalPages = data ? Math.ceil(data.total / DEFAULT_LIMIT) : 0;

  // -- 필터 초기화 --
  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(DEFAULT_PAGE);
  }, []);

  // -- 필터가 기본값과 다른지 확인 --
  const hasActiveFilters = useMemo(() => {
    return (
      filters.status !== "" ||
      filters.schoolLevel !== "" ||
      filters.itemType !== "" ||
      filters.difficultyMin !== "" ||
      filters.difficultyMax !== ""
    );
  }, [filters]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">문항 목록</h1>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={"/items/new" as any}>
          <Button>문항 등록</Button>
        </Link>
      </div>

      {/* 필터 바 */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <FilterSelect
            label="상태"
            value={filters.status}
            onChange={(v) => handleFilterChange("status", v)}
            options={QUALITY_STATUS_OPTIONS}
          />
          <FilterSelect
            label="학교급"
            value={filters.schoolLevel}
            onChange={(v) => handleFilterChange("schoolLevel", v)}
            options={SCHOOL_LEVEL_OPTIONS}
          />
          <FilterSelect
            label="문항 유형"
            value={filters.itemType}
            onChange={(v) => handleFilterChange("itemType", v)}
            options={ITEM_TYPE_OPTIONS}
          />
          <FilterSelect
            label="최소 난이도"
            value={filters.difficultyMin}
            onChange={(v) => handleFilterChange("difficultyMin", v)}
            options={DIFFICULTY_LEVEL_OPTIONS}
          />
          <FilterSelect
            label="최대 난이도"
            value={filters.difficultyMax}
            onChange={(v) => handleFilterChange("difficultyMax", v)}
            options={DIFFICULTY_LEVEL_OPTIONS}
          />
          <FilterSelect
            label="정렬 기준"
            value={filters.sortBy}
            onChange={(v) => handleFilterChange("sortBy", v)}
            options={SORT_BY_OPTIONS}
            placeholder=""
          />
          <FilterSelect
            label="정렬 순서"
            value={filters.sortOrder}
            onChange={(v) => handleFilterChange("sortOrder", v)}
            options={SORT_ORDER_OPTIONS}
            placeholder=""
          />
        </div>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              필터 초기화
            </Button>
          </div>
        )}
      </div>

      {/* 결과 영역 */}
      {isLoading && <LoadingGrid />}

      {isError && (
        <ErrorState
          message={error?.message ?? "문항 목록을 불러오는 중 오류가 발생했습니다."}
        />
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          {/* 결과 건수 */}
          <p className="mb-3 text-sm text-slate-500">
            총 {data.total}건
          </p>

          {/* 문항 그리드 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item: Item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={handleCardClick}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
