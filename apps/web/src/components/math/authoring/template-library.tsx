"use client";

import { useState, memo, useMemo } from "react";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { FORMULA_TEMPLATES, TEMPLATE_CATEGORIES } from "./template-data";

interface TemplateLibraryProps {
  readonly onInsert: (latex: string) => void;
}

const TemplateLibrary = memo(function TemplateLibrary({
  onInsert,
}: TemplateLibraryProps) {
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return FORMULA_TEMPLATES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [search]);

  const templates = filteredTemplates ?? FORMULA_TEMPLATES;
  const grouped = useMemo(() => {
    const map = new Map<string, typeof FORMULA_TEMPLATES>();
    for (const t of templates) {
      const arr = map.get(t.category) ?? [];
      map.set(t.category, [...arr, t]);
    }
    return map;
  }, [templates]);

  return (
    <div className="flex h-full flex-col gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="템플릿 검색 (예: 근의 공식, 적분)"
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      <div className="flex-1 overflow-y-auto">
        {TEMPLATE_CATEGORIES.map(({ key, label }) => {
          const items = grouped.get(key);
          if (!items || items.length === 0) return null;
          return (
            <details key={key} open={!!filteredTemplates}>
              <summary className="cursor-pointer px-1 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {label} ({items.length})
              </summary>
              <div className="flex flex-col gap-1 pb-2 pl-1">
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onInsert(t.latex)}
                    className="group flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-950"
                  >
                    <span className="shrink-0 text-xs text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400">
                      {t.label}
                    </span>
                    <span className="min-w-0 overflow-hidden">
                      <KatexRenderer latex={t.latex} className="text-xs" />
                    </span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
});

export { TemplateLibrary };
