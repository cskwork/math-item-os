"use client";

import { useState, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DIFFICULTY_LEVEL,
  QUALITY_STATUS,
  SCHOOL_LEVEL,
  BLOOM_LEVEL,
  ITEM_TYPE,
} from "@math-item-os/shared/constants/index";

// ─── 타입 정의 ───

interface SkillItemsPanelProps {
  readonly skillId: string | null;
  readonly onClose: () => void;
  readonly onItemClick?: (itemId: string) => void;
}

/** tRPC skill.getItems 응답의 단일 문항 */
interface ItemEntry {
  readonly id: string;
  readonly bodyLatex: string;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly status: string;
  readonly difficultyAuthor: number | null;
  readonly itemType: string;
  readonly skills: ReadonlyArray<{ skill: { id: string; title: string } }>;
}

const ITEMS_PER_PAGE = 10;

// ─── 배지 색상 매핑 ───

const DIFFICULTY_BADGE_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-lime-100 text-lime-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  reviewed: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  retired: "bg-red-100 text-red-700",
};

// ─── 유틸리티 ───

/** LaTeX 본문을 지정 길이로 절단 */
function truncateLatex(latex: string, maxLength: number): string {
  if (latex.length <= maxLength) return latex;
  return `${latex.slice(0, maxLength)}...`;
}

/** 문자열 키 상수에서 라벨 반환 */
function getLabel(map: Record<string, { label: string }>, key: string): string {
  return map[key]?.label ?? key;
}

/** 숫자 키 상수에서 라벨 반환 */
function getNumericLabel(map: Record<number, { label: string }>, key: number | null): string | null {
  if (key === null) return null;
  return map[key]?.label ?? String(key);
}

// ─── 스킬 정보 섹션 ───

const SkillInfoSection = memo(function SkillInfoSection({
  skillId,
}: {
  readonly skillId: string;
}) {
  const { data, isLoading } = trpc.skill.getById.useQuery({ skillId });

  if (isLoading) {
    return (
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!data?.skill) return null;

  const { skill } = data;
  const bloomLabel = getNumericLabel(
    BLOOM_LEVEL as unknown as Record<number, { label: string }>,
    skill.bloomLevel,
  );

  return (
    <div className="space-y-2 border-b border-slate-200 pb-4">
      {/* 코드 및 토픽 경로 */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
          {skill.code}
        </span>
        <span className="text-xs text-slate-400">{skill.topicPath}</span>
      </div>
      {skill.description && (
        <p className="text-sm text-slate-600">{skill.description}</p>
      )}
      {/* 메타 정보 */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {bloomLabel && (
          <span>블룸: <strong className="text-slate-700">{bloomLabel}</strong></span>
        )}
        {skill.estimatedTimeMin !== null && (
          <span>예상시간: <strong className="text-slate-700">{skill.estimatedTimeMin}분</strong></span>
        )}
        <span>문항: <strong className="text-slate-700">{skill._count.items}개</strong></span>
        <span>
          선수: <strong className="text-slate-700">{skill.prerequisitesFrom.length}개</strong>
          {" / "}후속: <strong className="text-slate-700">{skill.prerequisitesTo.length}개</strong>
        </span>
      </div>
    </div>
  );
});

// ─── 개별 문항 카드 ───

const ItemCard = memo(function ItemCard({
  item,
  onItemClick,
}: {
  readonly item: ItemEntry;
  readonly onItemClick?: (itemId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onItemClick?.(item.id);
  }, [onItemClick, item.id]);

  const difficultyLabel = getNumericLabel(
    DIFFICULTY_LEVEL as unknown as Record<number, { label: string }>,
    item.difficultyAuthor,
  );
  const difficultyColor = item.difficultyAuthor !== null
    ? DIFFICULTY_BADGE_COLORS[item.difficultyAuthor] ?? "bg-slate-100 text-slate-700"
    : null;
  const statusLabel = getLabel(QUALITY_STATUS, item.status);
  const statusColor = STATUS_BADGE_COLORS[item.status] ?? "bg-slate-100 text-slate-700";
  const schoolLabel = getLabel(SCHOOL_LEVEL, item.schoolLevel);
  const itemTypeLabel = getLabel(ITEM_TYPE, item.itemType);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onItemClick}
      className={cn(
        "w-full rounded-lg border border-slate-200 p-3 text-left transition-colors",
        onItemClick ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50/50" : "cursor-default",
      )}
    >
      <p className="text-sm text-slate-800 font-mono leading-relaxed">
        {truncateLatex(item.bodyLatex, 80)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {difficultyLabel && difficultyColor && (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", difficultyColor)}>
            {difficultyLabel}
          </span>
        )}
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusColor)}>
          {statusLabel}
        </span>
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {schoolLabel} {item.grade}학년
        </span>
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {itemTypeLabel}
        </span>
      </div>
    </button>
  );
});

// ─── 문항 목록 (페이지네이션 포함) ───

const ItemsList = memo(function ItemsList({
  skillId,
  onItemClick,
}: {
  readonly skillId: string;
  readonly onItemClick?: (itemId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.skill.getItems.useQuery({ skillId, page, limit: ITEMS_PER_PAGE });

  const handlePrev = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (!data) return;
    const maxPage = Math.ceil(data.total / data.limit);
    setPage((prev) => Math.min(maxPage, prev + 1));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-sm text-slate-400">연결된 문항이 없습니다</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-y-auto py-2">
        {data.items.map((item: ItemEntry) => (
          <ItemCard key={item.id} item={item} onItemClick={onItemClick} />
        ))}
      </div>
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
    </div>
  );
});

// ─── 메인 패널 컴포넌트 ───

function SkillItemsPanel({ skillId, onClose, onItemClick }: SkillItemsPanelProps) {
  const isOpen = skillId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-[480px] max-w-full flex-col sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>스킬 연결 문항</SheetTitle>
          <SheetDescription>선택한 스킬에 연결된 문항 목록입니다.</SheetDescription>
        </SheetHeader>
        {skillId && (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-2">
            <SkillInfoSection skillId={skillId} />
            <ItemsList skillId={skillId} onItemClick={onItemClick} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { SkillItemsPanel };
