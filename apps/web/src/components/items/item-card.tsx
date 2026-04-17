"use client";

import { memo, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { KatexRenderer } from "@/components/math/katex-renderer";
import {
  QUALITY_STATUS,
  ITEM_TYPE,
  DIFFICULTY_LEVEL,
  SCHOOL_LEVEL,
  type QualityStatusKey,
  type ItemTypeKey,
  type DifficultyLevelKey,
  type SchoolLevelKey,
} from "@math-item-os/shared/constants/index";

interface ItemCardItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly status: string;
  readonly currentVersion: number;
  readonly isGenerated: boolean;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly itemType: string;
  readonly difficultyAuthor: number | null;
  readonly createdAt: Date | string;
}

// ─── Props ───

export interface ItemCardProps {
  readonly item: ItemCardItem;
  readonly onClick?: (id: string) => void;
  readonly className?: string;
}

// ─── 상태 배지 색상 매핑 ───

const STATUS_COLOR_MAP: Record<QualityStatusKey, string> = {
  draft: "bg-gray-100 text-gray-700",
  reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  retired: "bg-red-100 text-red-700",
} as const;

// ─── 날짜 포맷 (상대 시간) ───

function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const target = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 30) return `${diffDays}일 전`;

  return target.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── LaTeX 미리보기 텍스트 잘라내기 (최대 100자) ───

const LATEX_PREVIEW_MAX_LENGTH = 100;

function truncateLatex(latex: string): string {
  if (latex.length <= LATEX_PREVIEW_MAX_LENGTH) return latex;
  return latex.slice(0, LATEX_PREVIEW_MAX_LENGTH) + "\\cdots";
}

// ─── 학교급 + 학년 라벨 생성 (예: "중2") ───

function formatSchoolGrade(schoolLevel: string, grade: number): string {
  const level = SCHOOL_LEVEL[schoolLevel as SchoolLevelKey];
  if (!level) return `${schoolLevel} ${grade}`;

  // "초등" -> "초", "중등" -> "중", "고등" -> "고"
  const shortLabel = level.label.replace("등", "");
  return `${shortLabel}${grade}`;
}

// ─── 메타 배지 컴포넌트 ───

function MetaBadge({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── ItemCard 컴포넌트 ───

const ItemCard = memo(function ItemCard({
  item,
  onClick,
  className,
}: ItemCardProps) {
  const handleClick = useCallback(() => {
    onClick?.(item.id);
  }, [onClick, item.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(item.id);
      }
    },
    [onClick, item.id],
  );

  // 상태 라벨 및 색상
  const statusKey = item.status as QualityStatusKey;
  const statusInfo = QUALITY_STATUS[statusKey];
  const statusLabel = statusInfo?.label ?? item.status;
  const statusColor = STATUS_COLOR_MAP[statusKey] ?? STATUS_COLOR_MAP.draft;

  // 문항 유형 라벨
  const itemTypeKey = item.itemType as ItemTypeKey;
  const itemTypeLabel = ITEM_TYPE[itemTypeKey]?.label ?? item.itemType;

  // 난이도 라벨
  const difficultyLabel =
    item.difficultyAuthor != null
      ? DIFFICULTY_LEVEL[item.difficultyAuthor as DifficultyLevelKey]?.label ??
        null
      : null;

  // LaTeX 미리보기 (stable identity to avoid KatexRenderer re-render thrash)
  const previewLatex = useMemo(() => truncateLatex(item.bodyLatex), [item.bodyLatex]);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900",
        "transition-shadow duration-150",
        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
        className,
      )}
    >
      {/* 헤더: 상태 배지 + 버전 + AI 생성 배지 */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            statusColor,
          )}
        >
          {statusLabel}
        </span>
        <span className="text-xs text-slate-400">v{item.currentVersion}</span>
        {item.isGenerated && (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
            AI
          </span>
        )}
      </div>

      {/* 본문: LaTeX 수식 미리보기 */}
      <div className="line-clamp-2 min-h-[2.5rem] overflow-hidden">
        <KatexRenderer
          latex={previewLatex}
          displayMode={false}
          className="text-sm leading-relaxed text-slate-800"
        />
      </div>

      {/* 푸터: 메타 태그 배지 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <MetaBadge>{formatSchoolGrade(item.schoolLevel, item.grade)}</MetaBadge>
        <MetaBadge>{itemTypeLabel}</MetaBadge>
        {difficultyLabel != null && <MetaBadge>{difficultyLabel}</MetaBadge>}
        <MetaBadge>{formatRelativeDate(item.createdAt)}</MetaBadge>
      </div>
    </div>
  );
});

export { ItemCard };
