"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BlockWrapperProps {
  readonly id: string;
  readonly index: number;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onRemove: () => void;
  readonly children: React.ReactNode;
}

export function BlockWrapper({
  id,
  index,
  isSelected,
  onSelect,
  onRemove,
  children,
}: BlockWrapperProps) {
  const { ref, isDragging } = useSortable({ id, index });

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={cn(
        "group relative rounded-lg border p-3 transition-colors",
        isDragging && "z-10 border-blue-300 bg-blue-50/50 shadow-lg",
        isSelected && !isDragging && "border-blue-400 ring-1 ring-blue-200",
        !isSelected && !isDragging && "border-slate-200 hover:border-slate-300",
      )}
    >
      {/* 상단 컨트롤 */}
      <div className="absolute -top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="h-6 w-6 rounded-full bg-white p-0 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600"
          aria-label="블록 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-start gap-2">
        {/* 드래그 핸들 */}
        <div className="flex shrink-0 cursor-grab items-center pt-0.5 text-slate-400 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* 블록 콘텐츠 */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
