"use client";

import { memo, useCallback } from "react";
import type { CanvasBlock } from "../types";

interface TextBlockProps {
  readonly block: CanvasBlock;
  readonly onContentChange: (text: string) => void;
}

export const TextBlock = memo(function TextBlock({
  block,
  onContentChange,
}: TextBlockProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onContentChange(e.target.value);
    },
    [onContentChange],
  );

  return (
    <textarea
      value={block.content?.text ?? ""}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      placeholder="텍스트를 입력하세요 (지시문, 설명 등)"
      rows={2}
      className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
    />
  );
});
