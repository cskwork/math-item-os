"use client";

import { Columns2, Columns3, AlignJustify, Hash, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LayoutConfig } from "./types";

interface CanvasToolbarProps {
  readonly layout: LayoutConfig;
  readonly onLayoutChange: (patch: Partial<LayoutConfig>) => void;
}

export function CanvasToolbar({
  layout,
  onLayoutChange,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* 컬럼 수 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500">레이아웃:</span>
        <div className="flex rounded-md border border-slate-200">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onLayoutChange({ columns: 1 })}
            className={cn(
              "h-7 rounded-r-none px-2",
              layout.columns === 1 && "bg-slate-100",
            )}
            aria-label="1열 레이아웃"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onLayoutChange({ columns: 2 })}
            className={cn(
              "h-7 rounded-l-none px-2",
              layout.columns === 2 && "bg-slate-100",
            )}
            aria-label="2열 레이아웃"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-4 w-px bg-slate-200" />

      {/* 문항번호 토글 */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onLayoutChange({ showItemNumbers: !layout.showItemNumbers })
        }
        className={cn(
          "h-7 gap-1 px-2 text-xs",
          layout.showItemNumbers && "bg-slate-100",
        )}
      >
        <Hash className="h-3 w-3" />
        번호
      </Button>

      {/* 배점 토글 */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onLayoutChange({ showPoints: !layout.showPoints })}
        className={cn(
          "h-7 gap-1 px-2 text-xs",
          layout.showPoints && "bg-slate-100",
        )}
      >
        <Award className="h-3 w-3" />
        배점
      </Button>
    </div>
  );
}
