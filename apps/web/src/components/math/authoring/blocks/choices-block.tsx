"use client";

import { memo, useCallback } from "react";
import { MathFieldEditor } from "../math-field-editor";
import { Button } from "@/components/ui/button";
import type { AuthoringBlock, ChoiceItem } from "../types";

interface ChoicesBlockProps {
  readonly block: AuthoringBlock;
  readonly editorMode: "visual" | "latex";
  readonly onUpdate: (blockId: string, patch: Partial<AuthoringBlock>) => void;
}

const CHOICE_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"] as const;

const ChoicesBlock = memo(function ChoicesBlock({ block, editorMode, onUpdate }: ChoicesBlockProps) {
  const choices = block.choices ?? [];

  const updateChoice = useCallback(
    (index: number, patch: Partial<ChoiceItem>) => {
      const updated = choices.map((c, i) => (i === index ? { ...c, ...patch } : c));
      onUpdate(block.id, { choices: updated });
    },
    [block.id, choices, onUpdate],
  );

  const addChoice = useCallback(() => {
    if (choices.length >= 8) return;
    const label = CHOICE_LABELS[choices.length] ?? `(${choices.length + 1})`;
    const newChoice: ChoiceItem = { label, latex: "", isCorrect: false };
    onUpdate(block.id, { choices: [...choices, newChoice] });
  }, [block.id, choices, onUpdate]);

  const removeChoice = useCallback(
    (index: number) => {
      if (choices.length <= 2) return;
      const filtered = choices.filter((_, i) => i !== index);
      const relabeled = filtered.map((c, i) => ({
        ...c,
        label: CHOICE_LABELS[i] ?? `(${i + 1})`,
      }));
      onUpdate(block.id, { choices: relabeled });
    },
    [block.id, choices, onUpdate],
  );

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => (
        <div key={index} className="flex items-start gap-2">
          {/* 정답 체크 */}
          <button
            type="button"
            onClick={() => updateChoice(index, { isCorrect: !choice.isCorrect })}
            className={`mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
              choice.isCorrect
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400"
            }`}
            title={choice.isCorrect ? "정답 해제" : "정답으로 설정"}
          >
            {choice.label}
          </button>

          {/* 수식 입력 */}
          <div className="flex-1">
            {editorMode === "visual" ? (
              <MathFieldEditor
                value={choice.latex}
                onChange={(latex) => updateChoice(index, { latex })}
                placeholder={`${choice.label} 보기 수식...`}
              />
            ) : (
              <input
                type="text"
                value={choice.latex}
                onChange={(e) => updateChoice(index, { latex: e.target.value })}
                placeholder={`${choice.label} LaTeX 입력...`}
                spellCheck={false}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-sm
                  focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                  dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>

          {/* 삭제 */}
          {choices.length > 2 && (
            <button
              type="button"
              onClick={() => removeChoice(index)}
              className="mt-1.5 text-slate-400 hover:text-red-500"
              title="보기 삭제"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      ))}

      {/* 보기 추가 */}
      {choices.length < 8 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addChoice}
          className="w-fit text-xs text-slate-500"
        >
          + 보기 추가
        </Button>
      )}
    </div>
  );
});

export { ChoicesBlock };
