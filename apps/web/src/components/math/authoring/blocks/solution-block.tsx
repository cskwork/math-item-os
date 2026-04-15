"use client";

import { memo, useCallback } from "react";
import { MathFieldEditor } from "../math-field-editor";
import type { AuthoringBlock } from "../types";

interface SolutionBlockProps {
  readonly block: AuthoringBlock;
  readonly editorMode: "visual" | "latex";
  readonly onUpdate: (blockId: string, patch: Partial<AuthoringBlock>) => void;
}

const SolutionBlock = memo(function SolutionBlock({ block, editorMode, onUpdate }: SolutionBlockProps) {
  const handleChange = useCallback(
    (latex: string) => {
      onUpdate(block.id, { solutionLatex: latex });
    },
    [block.id, onUpdate],
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">풀이 과정</label>
      {editorMode === "visual" ? (
        <MathFieldEditor
          value={block.solutionLatex ?? ""}
          onChange={handleChange}
          placeholder="풀이 과정을 입력하세요..."
          displayMode
        />
      ) : (
        <textarea
          value={block.solutionLatex ?? ""}
          onChange={(e) => onUpdate(block.id, { solutionLatex: e.target.value })}
          placeholder="풀이 LaTeX 직접 입력..."
          rows={3}
          spellCheck={false}
          className="resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
            dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      )}
    </div>
  );
});

export { SolutionBlock };
