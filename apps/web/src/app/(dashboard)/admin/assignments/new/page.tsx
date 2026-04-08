"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AssignmentBuilder,
  type AssignmentBuilderItem,
} from "@/components/admin/assignment-builder";

// --- 상수 ---

const MIN_ITEM_COUNT = 1;
const MAX_ITEM_COUNT = 50;
const DEFAULT_ITEM_COUNT = 10;
const DEFAULT_DIFFICULTY = 3;
const SEARCH_PAGE_LIMIT = 20;

// --- 목적 옵션 ---

const PURPOSE_OPTIONS = [
  { value: "diagnosis", label: "진단평가" },
  { value: "remediation", label: "보충학습" },
  { value: "pre_exam", label: "시험대비" },
  { value: "advanced", label: "심화학습" },
] as const;

type AssignmentPurpose = (typeof PURPOSE_OPTIONS)[number]["value"];

// --- 목적별 난이도 가이드 ---

const PURPOSE_DIFFICULTY_GUIDE: Record<AssignmentPurpose, string> = {
  diagnosis: "전 범위 (1~5)",
  remediation: "쉬운 문항 위주 (1~2)",
  pre_exam: "중상 난이도 (3~4)",
  advanced: "고난이도 (4~5)",
};

// --- 목적별 기본 난이도 범위 ---

const PURPOSE_DIFFICULTY_RANGE: Record<
  AssignmentPurpose,
  { min: number; max: number }
> = {
  diagnosis: { min: 1, max: 5 },
  remediation: { min: 1, max: 2 },
  pre_exam: { min: 3, max: 4 },
  advanced: { min: 4, max: 5 },
};

// --- 메인 페이지 ---

export default function NewAssignmentPage() {
  const router = useRouter();

  // 설정 상태
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState<AssignmentPurpose>("diagnosis");
  const [targetDifficulty, setTargetDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [itemCount, setItemCount] = useState(DEFAULT_ITEM_COUNT);
  const [searchQuery, setSearchQuery] = useState("");

  // 문항 상태
  const [selectedItems, setSelectedItems] = useState<AssignmentBuilderItem[]>(
    [],
  );

  // 검색/추천 상태
  const [showSearch, setShowSearch] = useState(false);
  const [recommendPage, setRecommendPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [isRecommending, setIsRecommending] = useState(false);

  // --- tRPC 쿼리 ---

  // 추천 문항 (목적/난이도 기반 필터)
  const difficultyRange = PURPOSE_DIFFICULTY_RANGE[purpose];
  const recommendInput = useMemo(
    () => ({
      filters: {
        difficultyMin: difficultyRange.min,
        difficultyMax: difficultyRange.max,
      },
      page: recommendPage,
      limit: SEARCH_PAGE_LIMIT,
      sort: "difficulty" as const,
    }),
    [difficultyRange.min, difficultyRange.max, recommendPage],
  );

  const recommendQuery = trpc.search.items.useQuery(recommendInput, {
    enabled: isRecommending,
  });

  // 수동 검색
  const searchInput = useMemo(
    () => ({
      query: searchQuery.trim() || undefined,
      filters: {
        difficultyMin: Math.max(1, targetDifficulty - 1),
        difficultyMax: Math.min(5, targetDifficulty + 1),
      },
      page: searchPage,
      limit: SEARCH_PAGE_LIMIT,
      sort: "relevance" as const,
    }),
    [searchQuery, targetDifficulty, searchPage],
  );

  const searchQueryResult = trpc.search.items.useQuery(searchInput, {
    enabled: showSearch && searchQuery.trim().length > 0,
  });

  // --- tRPC 뮤테이션 ---

  const createAssignmentMutation = trpc.admin.createAssignment.useMutation({
    onSuccess: (data) => {
      router.push(`/admin/assignments/${data.id}`);
    },
  });

  // --- 핸들러 ---

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handlePurposeChange = useCallback((value: AssignmentPurpose) => {
    setPurpose(value);
    setIsRecommending(false);
    setRecommendPage(1);
  }, []);

  const handleDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTargetDifficulty(Number(e.target.value));
    },
    [],
  );

  const handleItemCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(
        MIN_ITEM_COUNT,
        Math.min(MAX_ITEM_COUNT, Number(e.target.value)),
      );
      setItemCount(value);
    },
    [],
  );

  const handleRecommend = useCallback(() => {
    setRecommendPage(1);
    setIsRecommending(true);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
    setSearchPage(1);
  }, []);

  const handleSearchQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setSearchPage(1);
    },
    [],
  );

  const handleAddItem = useCallback(
    (item: AssignmentBuilderItem) => {
      // 중복 방지
      const alreadyExists = selectedItems.some((si) => si.id === item.id);
      if (alreadyExists) return;

      setSelectedItems((prev) => [...prev, item]);
    },
    [selectedItems],
  );

  const handleItemsChange = useCallback(
    (items: AssignmentBuilderItem[]) => {
      setSelectedItems(items);
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (title.trim().length === 0) return;
    if (selectedItems.length === 0) return;

    createAssignmentMutation.mutate({
      title: title.trim(),
      purpose,
      itemIds: selectedItems.map((item) => item.id),
      points: selectedItems.map((item) => item.points ?? 10),
    });
  }, [title, purpose, selectedItems, createAssignmentMutation]);

  // --- 파생 상태 ---

  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((item) => item.id)),
    [selectedItems],
  );

  const canSave = title.trim().length > 0 && selectedItems.length >= 1;

  const recommendedItems = recommendQuery.data?.items ?? [];
  const searchedItems = searchQueryResult.data?.items ?? [];
  const recommendTotal = recommendQuery.data?.total ?? 0;
  const searchTotal = searchQueryResult.data?.total ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">학습지 제작</h1>
        <p className="text-sm text-slate-500">
          목적에 맞는 문항을 추천받거나 직접 검색하여 학습지를 구성합니다
        </p>
      </div>

      {/* 2-column 레이아웃 */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 왼쪽 패널: 학습지 설정 */}
        <div className="w-[380px] shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <ConfigurationPanel
            title={title}
            purpose={purpose}
            targetDifficulty={targetDifficulty}
            itemCount={itemCount}
            isRecommending={recommendQuery.isFetching}
            onTitleChange={handleTitleChange}
            onPurposeChange={handlePurposeChange}
            onDifficultyChange={handleDifficultyChange}
            onItemCountChange={handleItemCountChange}
            onRecommend={handleRecommend}
            onToggleSearch={handleToggleSearch}
            showSearch={showSearch}
          />
        </div>

        {/* 오른쪽 패널: 문항 구성 */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          {/* 문항 빌더 */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
            {selectedItems.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">
                  아래에서 추천 또는 검색된 문항을 추가하세요
                </p>
              </div>
            ) : (
              <AssignmentBuilder
                items={selectedItems}
                onChange={handleItemsChange}
              />
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-500">
              선택된 문항: {selectedItems.length}개
            </p>
            <Button
              disabled={!canSave || createAssignmentMutation.isPending}
              onClick={handleSave}
            >
              {createAssignmentMutation.isPending
                ? "저장 중..."
                : "학습지 저장"}
            </Button>
          </div>

          {createAssignmentMutation.isError && (
            <p className="text-sm text-red-600">
              저장 실패: {createAssignmentMutation.error.message}
            </p>
          )}
        </div>
      </div>

      {/* 하단 패널: 추천/검색 결과 */}
      <div className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* 검색 입력 (토글) */}
        {showSearch && (
          <div className="border-b border-slate-200 p-3">
            <input
              type="text"
              placeholder="문항 키워드 검색..."
              value={searchQuery}
              onChange={handleSearchQueryChange}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>
        )}

        {/* 추천 결과 */}
        {isRecommending && !showSearch && (
          <RecommendedItemsPanel
            items={recommendedItems}
            total={recommendTotal}
            page={recommendPage}
            isLoading={recommendQuery.isLoading}
            selectedIds={selectedItemIds}
            onAdd={handleAddItem}
            onPageChange={setRecommendPage}
          />
        )}

        {/* 검색 결과 */}
        {showSearch && searchQuery.trim().length > 0 && (
          <SearchResultsPanel
            items={searchedItems}
            total={searchTotal}
            page={searchPage}
            isLoading={searchQueryResult.isLoading}
            selectedIds={selectedItemIds}
            onAdd={handleAddItem}
            onPageChange={setSearchPage}
          />
        )}

        {/* 빈 상태 */}
        {!isRecommending && !showSearch && (
          <div className="flex items-center justify-center p-6">
            <p className="text-sm text-slate-400">
              &quot;추천 받기&quot; 또는 &quot;검색 추가&quot; 버튼을 눌러
              문항을 탐색하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 설정 패널 ---

interface ConfigurationPanelProps {
  readonly title: string;
  readonly purpose: AssignmentPurpose;
  readonly targetDifficulty: number;
  readonly itemCount: number;
  readonly isRecommending: boolean;
  readonly showSearch: boolean;
  readonly onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onPurposeChange: (value: AssignmentPurpose) => void;
  readonly onDifficultyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onItemCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onRecommend: () => void;
  readonly onToggleSearch: () => void;
}

function ConfigurationPanel({
  title,
  purpose,
  targetDifficulty,
  itemCount,
  isRecommending,
  showSearch,
  onTitleChange,
  onPurposeChange,
  onDifficultyChange,
  onItemCountChange,
  onRecommend,
  onToggleSearch,
}: ConfigurationPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-slate-900">학습지 설정</h2>

      {/* 제목 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="assignment-title"
          className="text-xs font-medium text-slate-600"
        >
          제목
        </label>
        <input
          id="assignment-title"
          type="text"
          placeholder="예: 중2 일차방정식 진단평가"
          value={title}
          onChange={onTitleChange}
          className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        />
      </div>

      {/* 목적 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600">목적</span>
        <div className="flex flex-wrap gap-2">
          {PURPOSE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPurposeChange(option.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                purpose === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          추천 난이도 범위: {PURPOSE_DIFFICULTY_GUIDE[purpose]}
        </p>
      </div>

      {/* 난이도 슬라이더 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="target-difficulty"
          className="text-xs font-medium text-slate-600"
        >
          대상 난이도: {targetDifficulty}
        </label>
        <input
          id="target-difficulty"
          type="range"
          min={1}
          max={5}
          step={1}
          value={targetDifficulty}
          onChange={onDifficultyChange}
          className="w-full accent-slate-900"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>1 (쉬움)</span>
          <span>3 (보통)</span>
          <span>5 (어려움)</span>
        </div>
      </div>

      {/* 문항 수 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="item-count"
          className="text-xs font-medium text-slate-600"
        >
          문항 수
        </label>
        <input
          id="item-count"
          type="number"
          min={MIN_ITEM_COUNT}
          max={MAX_ITEM_COUNT}
          value={itemCount}
          onChange={onItemCountChange}
          className="h-9 w-24 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        />
        <p className="text-xs text-slate-400">
          {MIN_ITEM_COUNT}~{MAX_ITEM_COUNT}개 설정 가능
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={isRecommending}
          onClick={onRecommend}
          className="flex-1"
        >
          {isRecommending ? "추천 중..." : "추천 받기"}
        </Button>
        <Button
          variant={showSearch ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleSearch}
          className="flex-1"
        >
          {showSearch ? "검색 닫기" : "검색 추가"}
        </Button>
      </div>
    </div>
  );
}

// --- 추천 문항 패널 ---

interface SearchResultItemData {
  readonly id: string;
  readonly bodyLatex: string;
  readonly itemType: string;
  readonly difficultyAuthor: number | null;
  readonly schoolLevel: string;
  readonly grade: number;
}

interface RecommendedItemsPanelProps {
  readonly items: readonly SearchResultItemData[];
  readonly total: number;
  readonly page: number;
  readonly isLoading: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onAdd: (item: AssignmentBuilderItem) => void;
  readonly onPageChange: (page: number) => void;
}

function RecommendedItemsPanel({
  items,
  total,
  page,
  isLoading,
  selectedIds,
  onAdd,
  onPageChange,
}: RecommendedItemsPanelProps) {
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_LIMIT));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-sm text-slate-400">추천 문항을 불러오는 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-sm text-slate-400">
          조건에 맞는 추천 문항이 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">
          추천 문항 ({total}건)
        </h3>
        {totalPages > 1 && (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )}
      </div>
      <ItemCardList items={items} selectedIds={selectedIds} onAdd={onAdd} />
    </div>
  );
}

// --- 검색 결과 패널 ---

interface SearchResultsPanelProps {
  readonly items: readonly SearchResultItemData[];
  readonly total: number;
  readonly page: number;
  readonly isLoading: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onAdd: (item: AssignmentBuilderItem) => void;
  readonly onPageChange: (page: number) => void;
}

function SearchResultsPanel({
  items,
  total,
  page,
  isLoading,
  selectedIds,
  onAdd,
  onPageChange,
}: SearchResultsPanelProps) {
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_LIMIT));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-sm text-slate-400">검색 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-sm text-slate-400">검색 결과가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">
          검색 결과 ({total}건)
        </h3>
        {totalPages > 1 && (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )}
      </div>
      <ItemCardList items={items} selectedIds={selectedIds} onAdd={onAdd} />
    </div>
  );
}

// --- 문항 카드 목록 ---

interface ItemCardListProps {
  readonly items: readonly SearchResultItemData[];
  readonly selectedIds: ReadonlySet<string>;
  readonly onAdd: (item: AssignmentBuilderItem) => void;
}

function ItemCardList({ items, selectedIds, onAdd }: ItemCardListProps) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isAdded = selectedIds.has(item.id);

        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={isAdded}
              onClick={() =>
                onAdd({
                  id: item.id,
                  bodyLatex: item.bodyLatex,
                  itemType: item.itemType,
                  difficulty: item.difficultyAuthor ?? undefined,
                  points: 10,
                })
              }
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                isAdded
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-slate-800">
                  {item.bodyLatex.length > 60
                    ? `${item.bodyLatex.slice(0, 60)}...`
                    : item.bodyLatex}
                </p>
                <div className="mt-0.5 flex gap-2 text-xs text-slate-400">
                  <span>{item.schoolLevel}</span>
                  <span>{item.grade}학년</span>
                  {item.difficultyAuthor != null && (
                    <span>난이도 {item.difficultyAuthor}</span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  isAdded
                    ? "bg-slate-100 text-slate-500"
                    : "bg-slate-900 text-white",
                )}
              >
                {isAdded ? "추가됨" : "추가"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- 페이지네이션 컨트롤 ---

interface PaginationControlsProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        이전
      </button>
      <span className="text-xs text-slate-500">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}
