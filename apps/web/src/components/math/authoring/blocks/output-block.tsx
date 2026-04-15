"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AuthoringBlock } from "../types";

interface OutputBlockProps {
  readonly block: AuthoringBlock;
  readonly onUpdate: (id: string, patch: Partial<AuthoringBlock>) => void;
}

export const OutputBlock = memo(function OutputBlock({ block, onUpdate }: OutputBlockProps) {
  const expectedOutput = block.expectedOutput ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(block.id, { expectedOutput: e.target.value });
    },
    [block.id, onUpdate],
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        예상 실행 결과
      </label>
      <textarea
        value={expectedOutput}
        onChange={handleChange}
        placeholder="프로그램의 예상 출력값을 입력하세요..."
        rows={4}
        className={cn(
          "w-full rounded-md border border-input bg-muted/20 p-3",
          "font-mono text-sm leading-relaxed",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "resize-y",
        )}
      />
      {/* 프리뷰 */}
      {expectedOutput.trim() && (
        <div className="rounded-md border border-border bg-black/5 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">출력 미리보기</div>
          <pre className="font-mono text-sm whitespace-pre-wrap text-foreground">
            {expectedOutput}
          </pre>
        </div>
      )}
    </div>
  );
});
