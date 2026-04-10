"use client";

import { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { KatexRenderer } from "../katex-renderer";

export function MathBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateAttributes({ latex: e.target.value });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={`my-2 rounded-md border bg-slate-50 p-3 dark:bg-slate-800 ${
        selected
          ? "border-blue-300 ring-1 ring-blue-300 dark:border-blue-600 dark:ring-blue-600"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <textarea
        value={latex}
        onChange={handleChange}
        placeholder="LaTeX 수식을 입력하세요"
        spellCheck={false}
        rows={2}
        className="w-full resize-y rounded border border-slate-200 bg-white p-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-500"
      />
      <div className="mt-2 flex min-h-[40px] items-center justify-center">
        {latex.trim() ? (
          <KatexRenderer latex={latex} displayMode className="text-lg" />
        ) : (
          <span className="text-sm text-slate-400">미리보기가 여기에 표시됩니다</span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
