"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KatexRenderer } from "@/components/math/katex-renderer";
import {
  SCHOOL_LEVEL,
  ITEM_TYPE,
  QUALITY_STATUS,
  DIFFICULTY_LEVEL,
  type SchoolLevelKey,
  type ItemTypeKey,
  type QualityStatusKey,
  type DifficultyLevelKey,
} from "@math-item-os/shared/constants/index";

// --- 상태 배지 색상 ---
const STATUS_COLOR: Record<QualityStatusKey, string> = {
  draft: "bg-slate-100 text-slate-700",
  reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  retired: "bg-red-100 text-red-700",
} as const;

// --- Props ---
interface SearchResultItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodyHtml: string | null;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly itemType: string;
  readonly difficultyAuthor: number | null;
  readonly status: string;
  readonly isGenerated: boolean;
  readonly skills?: ReadonlyArray<{ skill: { id: string; title: string } }>;
}

export interface SearchResultsProps {
  readonly items: ReadonlyArray<SearchResultItem>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly queryTime?: number;
  readonly isLoading: boolean;
  readonly onPageChange: (page: number) => void;
}

// --- 유틸 ---
const LATEX_MAX = 100;

function truncateLatex(latex: string): string {
  return latex.length <= LATEX_MAX
    ? latex
    : latex.slice(0, LATEX_MAX) + "\\cdots";
}

function formatSchoolGrade(schoolLevel: string, grade: number): string {
  const level = SCHOOL_LEVEL[schoolLevel as SchoolLevelKey];
  if (!level) return `${schoolLevel} ${grade}`;
  return `${level.label.replace("등", "")}${grade}`;
}

// --- 메타 태그 ---
function Tag({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {children}
    </span>
  );
}

// --- 검색 결과 카드 ---
function SearchResultCard({
  item,
  onClick,
}: {
  readonly item: SearchResultItem;
  readonly onClick: (id: string) => void;
}) {
  const handleClick = useCallback(() => onClick(item.id), [onClick, item.id]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(item.id);
      }
    },
    [onClick, item.id],
  );

  const statusKey = item.status as QualityStatusKey;
  const statusLabel = QUALITY_STATUS[statusKey]?.label ?? item.status;
  const statusColor = STATUS_COLOR[statusKey] ?? STATUS_COLOR.draft;
  const typeLabel = ITEM_TYPE[item.itemType as ItemTypeKey]?.label ?? item.itemType;
  const diffLabel =
    item.difficultyAuthor != null
      ? (DIFFICULTY_LEVEL[item.difficultyAuthor as DifficultyLevelKey]?.label ?? null)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", statusColor)}>
          {statusLabel}
        </span>
        <span className="text-xs text-slate-500">{formatSchoolGrade(item.schoolLevel, item.grade)}</span>
        {item.isGenerated && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
            AI
          </span>
        )}
      </div>
      {/* 수식 미리보기 */}
      <div className="line-clamp-2 min-h-[2.5rem] overflow-hidden">
        <KatexRenderer latex={truncateLatex(item.bodyLatex)} displayMode={false} className="text-sm leading-relaxed text-slate-800" />
      </div>
      {/* 메타 태그 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag>{typeLabel}</Tag>
        {diffLabel != null && <Tag>{diffLabel}</Tag>}
        {item.skills?.map((s) => <Tag key={s.skill.id}>{s.skill.title}</Tag>)}
      </div>
    </div>
  );
}

// --- 스켈레톤 ---
const SKELETON_COUNT = 6;

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-12 rounded-full bg-slate-200" />
            <div className="h-4 w-8 rounded bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-200" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-5 w-14 rounded-full bg-slate-200" />
            <div className="h-5 w-16 rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- 빈 결과 ---
function EmptyResults() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg className="mb-3 h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <p className="text-sm">검색 결과가 없습니다</p>
    </div>
  );
}

// --- 페이지네이션 ---
function Pagination({ page, totalPages, onPageChange }: {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>이전</Button>
      <span className="text-sm text-slate-600">{page} / {totalPages} 페이지</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>다음</Button>
    </div>
  );
}

// --- 검색 결과 컴포넌트 ---
export function SearchResults({ items, total, page, limit, queryTime, isLoading, onPageChange }: SearchResultsProps) {
  const router = useRouter();
  const totalPages = Math.ceil(total / limit);
  const handleItemClick = useCallback((id: string) => { router.push(`/items/${id}`); }, [router]);

  if (isLoading) return <ResultsSkeleton />;
  if (items.length === 0) return <EmptyResults />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          총 {total}건{queryTime != null && ` (${queryTime}ms)`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <SearchResultCard key={item.id} item={item} onClick={handleItemClick} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
