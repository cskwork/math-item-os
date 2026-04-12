"use client";

import { memo, type ChangeEvent } from "react";

interface LatexSourceEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

const LatexSourceEditor = memo(function LatexSourceEditor({
  value,
  onChange,
}: LatexSourceEditorProps) {
  return (
    <div className="flex h-full flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">LaTeX 소스</span>
      <textarea
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none rounded-md border border-slate-200 bg-white p-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        placeholder="LaTeX 소스 코드가 여기에 표시됩니다"
      />
    </div>
  );
});

export { LatexSourceEditor };
