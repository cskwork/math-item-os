"use client";

import { useState, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

// ─── 타입 정의 ───

interface MisconceptionSelectorProps {
  readonly onSelect: (misconceptionId: string) => void;
  readonly selectedId?: string | null;
  readonly skillId?: string;
}

interface MisconceptionEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly typicalError: string | null;
  readonly remediation: string | null;
  readonly severity: number;
  readonly relatedSkills: readonly string[];
  readonly _count: { readonly items: number };
}

// ─── 상수 ───

const ITEMS_PER_PAGE = 10;

const SEVERITY_LABELS: Record<number, string> = {
  1: "매우 낮음",
  2: "낮음",
  3: "보통",
  4: "높음",
  5: "매우 높음",
};

const SEVERITY_BADGE_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-lime-100 text-lime-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

const SEVERITY_OPTIONS = [
  { value: null, label: "전체" },
  { value: 1, label: "매우 낮음" },
  { value: 2, label: "낮음" },
  { value: 3, label: "보통" },
  { value: 4, label: "높음" },
  { value: 5, label: "매우 높음" },
] as const;

// ─── 유틸리티 ───

/** 텍스트를 지정 길이로 절단 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// ─── 개별 오개념 카드 ───

const MisconceptionCard = memo(function MisconceptionCard({
  misconception,
  isSelected,
  onSelect,
}: {
  readonly misconception: MisconceptionEntry;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(misconception.id);
  }, [onSelect, misconception.id]);

  const severityLabel = SEVERITY_LABELS[misconception.severity] ?? String(misconception.severity);
  const severityColor = SEVERITY_BADGE_COLORS[misconception.severity] ?? "bg-slate-100 text-slate-700";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
          : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50",
      )}
    >
      {/* 코드 및 심각도 배지 */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
          {misconception.code}
        </span>
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", severityColor)}>
          {severityLabel}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          {misconception._count.items}개 연결 문항
        </span>
      </div>

      {/* 제목 */}
      <p className="mt-1.5 text-sm font-medium text-slate-800">
        {misconception.title}
      </p>

      {/* 전형적 오류 미리보기 */}
      {misconception.typicalError && (
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {truncateText(misconception.typicalError, 100)}
        </p>
      )}
    </button>
  );
});

// ─── 심각도 필터 ───

const SeverityFilter = memo(function SeverityFilter({
  selected,
  onChange,
}: {
  readonly selected: number | null;
  readonly onChange: (severity: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {SEVERITY_OPTIONS.map((option) => {
        const isActive = selected === option.value;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
});

// ─── 로딩 스켈레톤 ───

function LoadingSkeleton() {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto py-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="space-y-2 rounded-lg border border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

// ─── 빈 상태 ───

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
      <AlertTriangle className="h-8 w-8 text-slate-300" />
      <p className="text-sm text-slate-400">등록된 오개념이 없습니다</p>
    </div>
  );
}

// ─── 메인 컴포넌트 ───

function MisconceptionSelector({ onSelect, selectedId, skillId }: MisconceptionSelectorProps) {
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<number | null>(null);

  const { data, isLoading } = trpc.skill.listMisconceptions.useQuery({
    skillId,
    severity: severityFilter ?? undefined,
    page,
    limit: ITEMS_PER_PAGE,
  });

  const handleSeverityChange = useCallback((severity: number | null) => {
    setSeverityFilter(severity);
    setPage(1);
  }, []);

  const handlePrev = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (!data) return;
    const maxPage = Math.ceil(data.total / data.limit);
    setPage((prev) => Math.min(maxPage, prev + 1));
  }, [data]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* 심각도 필터 */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-slate-500">심각도 필터</span>
        <SeverityFilter selected={severityFilter} onChange={handleSeverityChange} />
      </div>

      {/* 오개념 목록 */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : !data || data.misconceptions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-2">
            {data.misconceptions.map((misconception: MisconceptionEntry) => (
              <MisconceptionCard
                key={misconception.id}
                misconception={misconception}
                isSelected={selectedId === misconception.id}
                onSelect={onSelect}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages} ({data.total}개)
              </span>
              <Button variant="outline" size="sm" onClick={handleNext} disabled={page >= totalPages}>
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { MisconceptionSelector };
