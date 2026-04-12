"use client";

import { memo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { AuthoringBlock } from "../types";

interface ImageBlockProps {
  readonly block: AuthoringBlock;
  readonly onUpdate: (blockId: string, patch: Partial<AuthoringBlock>) => void;
}

const ImageBlock = memo(function ImageBlock({ block, onUpdate }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 로컬 프리뷰 URL 생성
      const url = URL.createObjectURL(file);
      onUpdate(block.id, { imageUrl: url, imageAlt: file.name });
    },
    [block.id, onUpdate],
  );

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(block.id, { imageUrl: e.target.value });
    },
    [block.id, onUpdate],
  );

  const handleAltChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(block.id, { imageAlt: e.target.value });
    },
    [block.id, onUpdate],
  );

  return (
    <div className="flex flex-col gap-3">
      {block.imageUrl ? (
        /* 이미지 프리뷰 */
        <div className="relative">
          <img
            src={block.imageUrl}
            alt={block.imageAlt ?? "문항 이미지"}
            className="max-h-[300px] rounded-md border border-slate-200 object-contain dark:border-slate-700"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(block.id, { imageUrl: "", imageAlt: "" })}
            className="absolute right-1 top-1 h-6 bg-white/80 text-xs text-red-500 hover:bg-white dark:bg-slate-900/80"
          >
            삭제
          </Button>
        </div>
      ) : (
        /* 업로드 영역 */
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300
            bg-slate-50 text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-500
            dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          <span className="text-sm">이미지를 선택하세요</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      {/* URL 직접 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={block.imageUrl ?? ""}
          onChange={handleUrlChange}
          placeholder="이미지 URL (선택사항)"
          className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
            dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="text"
          value={block.imageAlt ?? ""}
          onChange={handleAltChange}
          placeholder="대체 텍스트"
          className="h-8 w-40 rounded-md border border-slate-200 bg-white px-3 text-xs
            focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
            dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </div>
  );
});

export { ImageBlock };
