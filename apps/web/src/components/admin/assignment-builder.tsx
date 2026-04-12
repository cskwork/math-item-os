"use client";

import { useCallback, useMemo, memo } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { cn } from "@/lib/utils";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { Button } from "@/components/ui/button";

type DragEndHandler = NonNullable<
  React.ComponentProps<typeof DragDropProvider>["onDragEnd"]
>;
type DragEndEventArg = Parameters<DragEndHandler>[0];

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
      성취기준: {skills.map((s) => s.skill.title).join(", ")}
    </span>
  );
});

// ─── 개별 문항 행 (Sortable) ───

interface SortableItemRowProps {
  readonly entry: AssignmentBuilderItem;
  readonly index: number;
  readonly isReadOnly: boolean;
  readonly onPointsChange: (index: number, points: number) => void;
  readonly onRemove: (itemId: string) => void;
}

function SortableItemRow({
  entry,
  index,
  isReadOnly,
  onPointsChange,
  onRemove,
}: SortableItemRowProps) {
  const { item, position, points } = entry;

  const { ref, isDragging } = useSortable({
    id: item.id,
    index,
    disabled: isReadOnly,
  });

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
      ref={ref}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-slate-200 p-3 transition-colors",
        "hover:border-slate-300 hover:bg-slate-50/50",
        isDragging && "z-10 border-blue-300 bg-blue-50/50 shadow-lg",
      )}
    >
      {/* 드래그 핸들 */}
      {!isReadOnly && (
        <div className="flex shrink-0 cursor-grab items-center pt-0.5 text-slate-400 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* 순서 번호 */}
      <span className="shrink-0 pt-0.5 text-sm font-semibold text-slate-600">
        {position}.
      </span>

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
}

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

  // ── DnD 핸들러 ──

  const handleDragEnd = useCallback(
    (event: DragEndEventArg) => {
      if (event.canceled) return;

      const { source } = event.operation;
      if (!source || !isSortable(source)) return;
      if (!("initialIndex" in source)) return;

      const fromIndex = source.initialIndex as number;
      const toIndex = source.index;
      if (fromIndex === toIndex) return;

      const reordered = [...items];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, removed);
      onItemsChange(recalculatePositions(reordered));
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
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="space-y-2">
            {items.map((entry, index) => (
              <SortableItemRow
                key={entry.item.id}
                entry={entry}
                index={index}
                isReadOnly={isReadOnly}
                onPointsChange={handlePointsChange}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        </DragDropProvider>
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
