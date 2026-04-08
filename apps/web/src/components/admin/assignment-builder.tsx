"use client";

import { useCallback, useMemo, memo } from "react";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { Button } from "@/components/ui/button";

// ─── 타입 정의 ───

interface AssignmentItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly bodyHtml?: string | null;
  readonly difficultyAuthor?: number | null;
  readonly itemType?: string;
  readonly skills?: ReadonlyArray<{ readonly skill: { readonly title: string } }>;
}

interface AssignmentBuilderItem {
  readonly item: AssignmentItem;
  readonly position: number;
  readonly points: number;
}

interface AssignmentBuilderProps {
  readonly items: ReadonlyArray<AssignmentBuilderItem>;
  readonly onItemsChange: (items: ReadonlyArray<AssignmentBuilderItem>) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly isReadOnly?: boolean;
}

// ─── 상수 ───

const DEFAULT_POINTS = 10;
const BODY_PREVIEW_MAX_LENGTH = 80;

/** 난이도별 배지 색상 매핑 */
const DIFFICULTY_COLOR_MAP: Record<number, string> = {
  1: "border-green-300 bg-green-50 text-green-700",
  2: "border-blue-300 bg-blue-50 text-blue-700",
  3: "border-yellow-300 bg-yellow-50 text-yellow-700",
  4: "border-orange-300 bg-orange-50 text-orange-700",
  5: "border-red-300 bg-red-50 text-red-700",
};

const DEFAULT_DIFFICULTY_COLOR = "border-slate-300 bg-slate-50 text-slate-700";

// ─── 유틸리티 ───

/** bodyLatex를 미리보기용으로 잘라낸 문자열 반환 */
function truncateBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}\\ldots`;
}

/** 난이도 숫자에 해당하는 배지 CSS 클래스 반환 */
function getDifficultyColor(difficulty: number): string {
  return DIFFICULTY_COLOR_MAP[difficulty] ?? DEFAULT_DIFFICULTY_COLOR;
}

/** 위치 번호를 재계산한 새 배열 반환 (불변) */
function recalculatePositions(
  items: ReadonlyArray<AssignmentBuilderItem>,
): ReadonlyArray<AssignmentBuilderItem> {
  return items.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));
}

/** 두 인덱스의 항목을 교환한 새 배열 반환 (불변) */
function swapItems(
  items: ReadonlyArray<AssignmentBuilderItem>,
  indexA: number,
  indexB: number,
): ReadonlyArray<AssignmentBuilderItem> {
  const mutable = [...items];
  const temp = mutable[indexA];
  mutable[indexA] = mutable[indexB];
  mutable[indexB] = temp;
  return recalculatePositions(mutable);
}

// ─── 난이도 배지 ───

interface DifficultyBadgeProps {
  readonly difficulty: number;
}

const DifficultyBadge = memo(function DifficultyBadge({
  difficulty,
}: DifficultyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        getDifficultyColor(difficulty),
      )}
    >
      난이도{difficulty}
    </span>
  );
});

// ─── 문항 유형 배지 ───

interface ItemTypeBadgeProps {
  readonly itemType: string;
}

const ItemTypeBadge = memo(function ItemTypeBadge({
  itemType,
}: ItemTypeBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
      {itemType}
    </span>
  );
});

// ─── 스킬 태그 목록 ───

interface SkillTagsProps {
  readonly skills: ReadonlyArray<{ readonly skill: { readonly title: string } }>;
}

const SkillTags = memo(function SkillTags({ skills }: SkillTagsProps) {
  if (skills.length === 0) return null;

  return (
    <span className="text-xs text-slate-500">
      스킬: {skills.map((s) => s.skill.title).join(", ")}
    </span>
  );
});

// ─── 개별 문항 행 ───

interface ItemRowProps {
  readonly entry: AssignmentBuilderItem;
  readonly index: number;
  readonly totalCount: number;
  readonly isReadOnly: boolean;
  readonly onMoveUp: (index: number) => void;
  readonly onMoveDown: (index: number) => void;
  readonly onPointsChange: (index: number, points: number) => void;
  readonly onRemove: (itemId: string) => void;
}

const ItemRow = memo(function ItemRow({
  entry,
  index,
  totalCount,
  isReadOnly,
  onMoveUp,
  onMoveDown,
  onPointsChange,
  onRemove,
}: ItemRowProps) {
  const { item, position, points } = entry;

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  const handleMoveUp = useCallback(() => {
    onMoveUp(index);
  }, [onMoveUp, index]);

  const handleMoveDown = useCallback(() => {
    onMoveDown(index);
  }, [onMoveDown, index]);

  const handlePointsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onPointsChange(index, Number.isNaN(value) ? 0 : value);
    },
    [onPointsChange, index],
  );

  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [onRemove, item.id]);

  const previewText = truncateBody(item.bodyLatex, BODY_PREVIEW_MAX_LENGTH);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-slate-200 p-3 transition-colors",
        "hover:border-slate-300 hover:bg-slate-50/50",
      )}
    >
      {/* 순서 표시 아이콘 */}
      <div className="flex shrink-0 items-center pt-0.5 text-slate-400">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* 순서 번호 */}
      <span className="shrink-0 pt-0.5 text-sm font-semibold text-slate-600">
        {position}.
      </span>

      {/* 이동 버튼 */}
      {!isReadOnly && (
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMoveUp}
            disabled={isFirst}
            className="h-6 w-6 p-0"
            aria-label="위로 이동"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMoveDown}
            disabled={isLast}
            className="h-6 w-6 p-0"
            aria-label="아래로 이동"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 문항 내용 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* 상단: 본문 미리보기 + 배지 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-slate-800">
            <KatexRenderer latex={previewText} displayMode={false} />
          </span>
          {item.difficultyAuthor != null && (
            <DifficultyBadge difficulty={item.difficultyAuthor} />
          )}
          {item.itemType != null && (
            <ItemTypeBadge itemType={item.itemType} />
          )}
        </div>

        {/* 하단: 스킬 태그 */}
        {item.skills != null && item.skills.length > 0 && (
          <SkillTags skills={item.skills} />
        )}
      </div>

      {/* 배점 입력 */}
      <div className="flex shrink-0 items-center gap-1">
        {isReadOnly ? (
          <span className="text-sm font-medium text-slate-700">
            {points}점
          </span>
        ) : (
          <>
            <input
              type="number"
              value={points}
              onChange={handlePointsChange}
              min={0}
              step={0.5}
              className={cn(
                "h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm",
                "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
              )}
              aria-label="배점"
            />
            <span className="text-xs text-slate-500">점</span>
          </>
        )}
      </div>

      {/* 삭제 버튼 */}
      {!isReadOnly && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="h-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
          aria-label="문항 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

// ─── 메인 컴포넌트 ───

export function AssignmentBuilder({
  items,
  onItemsChange,
  onRemoveItem,
  isReadOnly = false,
}: AssignmentBuilderProps) {
  // ── 집계 데이터 ──

  const totalPoints = useMemo(
    () => items.reduce((sum, entry) => sum + entry.points, 0),
    [items],
  );

  const totalCount = items.length;

  // ── 이동 핸들러 ──

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const updated = swapItems(items, index, index - 1);
      onItemsChange(updated);
    },
    [items, onItemsChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;
      const updated = swapItems(items, index, index + 1);
      onItemsChange(updated);
    },
    [items, onItemsChange],
  );

  // ── 배점 변경 핸들러 ──

  const handlePointsChange = useCallback(
    (index: number, points: number) => {
      const updated = items.map((entry, i) =>
        i === index ? { ...entry, points } : entry,
      );
      onItemsChange(updated);
    },
    [items, onItemsChange],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          문항 구성{" "}
          <span className="font-normal text-slate-500">
            ({totalCount}문항, 총 {totalPoints}점)
          </span>
        </h3>
      </div>

      {/* 문항 목록 */}
      {totalCount === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-12">
          <p className="text-sm text-slate-400">
            추천 또는 검색으로 문항을 추가해주세요
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((entry, index) => (
            <ItemRow
              key={entry.item.id}
              entry={entry}
              index={index}
              totalCount={totalCount}
              isReadOnly={isReadOnly}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onPointsChange={handlePointsChange}
              onRemove={onRemoveItem}
            />
          ))}
        </div>
      )}

      {/* 요약 푸터 */}
      {totalCount > 0 && (
        <div className="flex items-center justify-end border-t border-slate-200 pt-3">
          <span className="text-sm font-medium text-slate-700">
            합계: {totalCount}문항 / {totalPoints}점
          </span>
        </div>
      )}
    </div>
  );
}

export type {
  AssignmentBuilderProps,
  AssignmentBuilderItem,
  AssignmentItem,
};
