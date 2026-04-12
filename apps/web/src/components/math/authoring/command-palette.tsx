"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { SYMBOL_CATEGORIES, toPlainLatex } from "./symbol-palette";
import { FORMULA_TEMPLATES } from "./template-data";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onInsert: (latex: string) => void;
  readonly filter: string;
}

interface SearchResult {
  readonly label: string;
  readonly latex: string;
  readonly source: "symbol" | "template";
}

function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = [];
  for (const cat of SYMBOL_CATEGORIES) {
    for (const sym of cat.symbols) {
      results.push({
        label: `${sym.tooltip} (${sym.label})`,
        latex: toPlainLatex(sym.latex),
        source: "symbol",
      });
    }
  }
  for (const tpl of FORMULA_TEMPLATES) {
    results.push({
      label: `${tpl.label} [${tpl.tags.join(", ")}]`,
      latex: tpl.latex,
      source: "template",
    });
  }
  return results;
}

const SEARCH_INDEX = buildSearchIndex();
const MAX_RESULTS = 20;

const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  onInsert,
  filter,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const query = filter.replace(/^\\/, "").toLowerCase();
  const results = query
    ? SEARCH_INDEX.filter(
        (r) =>
          r.label.toLowerCase().includes(query) ||
          r.latex.toLowerCase().includes(query),
      ).slice(0, MAX_RESULTS)
    : SEARCH_INDEX.slice(0, MAX_RESULTS);

  // 선택 인덱스 범위 보정
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[selectedIndex];
        if (item) onInsert(item.latex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [open, results, selectedIndex, onInsert, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 선택 항목이 보이도록 스크롤
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open || results.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-10 mb-1 w-80 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900" ref={listRef}>
      {results.map((r, i) => (
        <button
          key={`${r.source}-${r.latex}-${i}`}
          type="button"
          onClick={() => onInsert(r.latex)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
            i === selectedIndex
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
            {r.source === "symbol" ? "S" : "T"}
          </span>
          <span className="truncate">{r.label}</span>
        </button>
      ))}
    </div>
  );
});

export { CommandPalette };
