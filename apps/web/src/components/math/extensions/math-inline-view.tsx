"use client";

import { useState, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { KatexRenderer } from "../katex-renderer";

export function MathInlineView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const latex = (node.attrs.latex as string) ?? "";

  const handleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Escape") {
        setEditing(false);
      }
    },
    [],
  );

  return (
    <NodeViewWrapper as="span" className="inline">
      {editing ? (
        <input
          type="text"
          value={latex}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="inline-block rounded border border-slate-300 bg-white px-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          style={{ minWidth: "3em" }}
        />
      ) : (
        <span
          onClick={handleClick}
          className={`inline-block cursor-pointer rounded px-0.5 ${
            selected
              ? "bg-blue-100 dark:bg-blue-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title="클릭하여 수식 편집"
        >
          {latex.trim() ? (
            <KatexRenderer latex={latex} displayMode={false} />
          ) : (
            <span className="font-mono text-xs text-slate-400">$...$</span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
