"use client";

import { Type, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockType } from "./types";

interface PaletteItem {
  readonly type: BlockType;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const PALETTE_ITEMS: ReadonlyArray<PaletteItem> = [
  { type: "text", label: "텍스트", icon: <Type className="h-4 w-4" /> },
  { type: "divider", label: "구분선", icon: <Minus className="h-4 w-4" /> },
];

interface ComponentPaletteProps {
  readonly onAddBlock: (type: BlockType) => void;
}

export function ComponentPalette({ onAddBlock }: ComponentPaletteProps) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-slate-600">블록 추가</h4>
      <div className="flex gap-1.5">
        {PALETTE_ITEMS.map((item) => (
          <Button
            key={item.type}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddBlock(item.type)}
            className="flex items-center gap-1.5 text-xs"
          >
            {item.icon}
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
