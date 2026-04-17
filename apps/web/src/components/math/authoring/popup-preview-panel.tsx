"use client";

import { useState, useEffect, useRef, memo } from "react";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface PopupPreviewPanelProps {
  readonly latex: string;
}

const PopupPreviewPanel = memo(function PopupPreviewPanel({
  latex,
}: PopupPreviewPanelProps) {
  const debouncedLatex = useDebounce(latex, 300);
  const [parseError, setParseError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const errorEl = containerRef.current.querySelector(".katex-error");
    setParseError(
      errorEl ? (errorEl.getAttribute("title") ?? "수식 파싱 에러") : null,
    );
  }, [debouncedLatex]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">미리보기</span>
        {debouncedLatex.trim() && (
          <span
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
              parseError
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
            )}
          >
            {parseError ? "!" : "\u2713"}
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className={cn(
          "flex min-h-[80px] items-center justify-center rounded-md border bg-white p-3 dark:bg-slate-950",
          parseError
            ? "border-amber-300 dark:border-amber-600"
            : "border-slate-200 dark:border-slate-700",
        )}
      >
        {debouncedLatex.trim() ? (
          <KatexRenderer latex={debouncedLatex} displayMode className="text-lg" />
        ) : (
          <span className="text-sm text-slate-400">수식을 입력하면 미리보기가 표시됩니다</span>
        )}
      </div>
      {parseError && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{parseError}</p>
      )}
    </div>
  );
});

export { PopupPreviewPanel };
