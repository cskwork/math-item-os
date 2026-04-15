"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { KatexRenderer } from "@/components/math/katex-renderer";
import type { CanvasBlock } from "../types";

const BODY_PREVIEW_MAX_LENGTH = 120;

const DIFFICULTY_COLOR_MAP: Record<number, string> = {
  1: "border-green-300 bg-green-50 text-green-700",
  2: "border-blue-300 bg-blue-50 text-blue-700",
  3: "border-yellow-300 bg-yellow-50 text-yellow-700",
  4: "border-orange-300 bg-orange-50 text-orange-700",
  5: "border-red-300 bg-red-50 text-red-700",
};

interface MathItemBlockProps {
  readonly block: CanvasBlock;
  readonly showNumber?: number;
  readonly showPoints: boolean;
  readonly onPointsChange: (points: number) => void;
}

export const MathItemBlock = memo(function MathItemBlock({
  block,
  showNumber,
  showPoints,
  onPointsChange,
}: MathItemBlockProps) {
  const item = block.item;
  if (!item) return null;

  const bodyPreview =
    item.bodyLatex.length > BODY_PREVIEW_MAX_LENGTH
      ? `${item.bodyLatex.slice(0, BODY_PREVIEW_MAX_LENGTH)}\\ldots`
      : item.bodyLatex;

  const difficultyColor =
    DIFFICULTY_COLOR_MAP[item.difficultyAuthor ?? 0] ??
    "border-slate-300 bg-slate-50 text-slate-700";

  const handlePointsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      onPointsChange(Number.isNaN(value) ? 0 : value);
    },
    [onPointsChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* 문항 번호 + 배지 */}
      <div className="flex items-center gap-2">
        {showNumber != null && (
          <span className="text-sm font-semibold text-slate-600">
            {showNumber}.
          </span>
        )}
        {item.difficultyAuthor != null && (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
              difficultyColor,
            )}
          >
            난이도{item.difficultyAuthor}
          </span>
        )}
        {item.itemType != null && (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
            {item.itemType}
          </span>
        )}
        {showPoints && (
          <div className="ml-auto flex items-center gap-1">
            <input
              type="number"
              value={block.points ?? 10}
              onChange={handlePointsChange}
              onClick={(e) => e.stopPropagation()}
              min={0}
              step={0.5}
              className="h-7 w-14 rounded-md border border-slate-200 px-1.5 text-right text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              aria-label="배점"
            />
            <span className="text-xs text-slate-500">점</span>
          </div>
        )}
      </div>

      {/* 본문 미리보기 */}
      <div className="text-sm text-slate-800">
        <KatexRenderer latex={bodyPreview} displayMode={false} />
      </div>

      {/* 스킬 태그 */}
      {item.skills != null && item.skills.length > 0 && (
        <span className="text-xs text-slate-500">
          성취기준: {item.skills.map((s) => s.skill.title).join(", ")}
        </span>
      )}
    </div>
  );
});
