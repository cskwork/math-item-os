"use client";

import { useState, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SYMBOL_CATEGORIES, toPlainLatex } from "./symbol-palette";

interface SearchSymbolPaletteProps {
  readonly onInsert: (latex: string) => void;
}

const SearchSymbolPalette = memo(function SearchSymbolPalette({
  onInsert,
}: SearchSymbolPaletteProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);

  const filteredSymbols = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return SYMBOL_CATEGORIES.flatMap((cat) =>
      cat.symbols.filter(
        (sym) =>
          sym.tooltip.toLowerCase().includes(q) ||
          sym.label.toLowerCase().includes(q) ||
          sym.latex.toLowerCase().includes(q),
      ),
    );
  }, [search]);

  const activeSymbols = filteredSymbols ?? SYMBOL_CATEGORIES[activeCategory]?.symbols ?? [];

  return (
    <div className="flex h-full flex-col gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="기호 검색 (예: 적분, alpha)"
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      {/* 카테고리 탭 (검색 중이 아닐 때만) */}
      {!filteredSymbols && (
        <div className="flex flex-wrap gap-1">
          {SYMBOL_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                i === activeCategory
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
              )}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 기호 그리드 */}
      <div className="flex flex-wrap gap-1 overflow-y-auto">
        {activeSymbols.map((sym, i) => (
          <Tooltip key={`${sym.latex}-${i}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onInsert(toPlainLatex(sym.latex))}
                className="flex h-8 min-w-[36px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-blue-950"
              >
                {sym.label}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{sym.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {activeSymbols.length === 0 && (
          <p className="px-2 py-4 text-xs text-slate-400">검색 결과가 없습니다</p>
        )}
      </div>
    </div>
  );
});

export { SearchSymbolPalette };
