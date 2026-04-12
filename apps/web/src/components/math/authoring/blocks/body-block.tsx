"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { SymbolPalette } from "../symbol-palette";
import { KatexRenderer } from "@/components/math/katex-renderer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AuthoringBlock } from "../types";

// --- MathLive 동적 로드 (수식 조립 팝업 전용) ---

let mathLiveLoaded = false;
let mathLiveLoading: Promise<void> | null = null;

function ensureMathLive(): Promise<void> {
  if (mathLiveLoaded) return Promise.resolve();
  if (mathLiveLoading) return mathLiveLoading;
  mathLiveLoading = import("mathlive").then(() => { mathLiveLoaded = true; });
  return mathLiveLoading;
}

// --- 타입 ---

interface BodyBlockProps {
  readonly block: AuthoringBlock;
  readonly editorMode: "visual" | "latex";
  readonly onUpdate: (blockId: string, patch: Partial<AuthoringBlock>) => void;
}

const BodyBlock = memo(function BodyBlock({ block, editorMode, onUpdate }: BodyBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const content = block.latex ?? "";
  const [showPalette, setShowPalette] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [mlReady, setMlReady] = useState(mathLiveLoaded);
  const [composerValue, setComposerValue] = useState("");
  const composerContainerRef = useRef<HTMLDivElement>(null);
  const composerMfRef = useRef<any>(null);
  const initialComposerValueRef = useRef("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(block.id, { latex: e.target.value });
    },
    [block.id, onUpdate],
  );

  // --- textarea 커서 위치에 텍스트 삽입 ---
  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + text + content.slice(end);
      onUpdate(block.id, { latex: newContent });
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    [block.id, content, onUpdate],
  );

  // --- 기호 팔레트에서 클릭 → $기호$ 삽입 ---
  const handleSymbolInsert = useCallback(
    (latex: string) => {
      insertAtCursor(`$${latex}$`);
    },
    [insertAtCursor],
  );

  // --- 수식 조립기 (MathLive 팝업) ---

  const openComposer = useCallback(() => {
    const ta = textareaRef.current;
    let initial = "";
    if (ta) {
      const selected = content.slice(ta.selectionStart, ta.selectionEnd);
      const match = selected.match(/^\$(.+)\$$/);
      if (match) initial = match[1];
    }
    setComposerValue(initial);
    initialComposerValueRef.current = initial;
    setShowComposer(true);
    ensureMathLive().then(() => setMlReady(true));
  }, [content]);

  useEffect(() => {
    if (!showComposer || !mlReady || !composerContainerRef.current) return;
    if (composerMfRef.current) return;

    const mf = document.createElement("math-field") as any;
    mf.style.width = "100%";
    mf.style.minHeight = "56px";
    mf.style.fontSize = "1.25rem";
    mf.style.padding = "10px 14px";
    mf.style.borderRadius = "8px";
    mf.style.border = "2px solid #3b82f6";
    mf.style.background = "white";
    mf.style.outline = "none";
    mf.setAttribute("virtual-keyboard-mode", "onfocus");

    mf.addEventListener("input", () => {
      setComposerValue(mf.value);
    });

    composerContainerRef.current.appendChild(mf);
    composerMfRef.current = mf;
    if (initialComposerValueRef.current) {
      mf.value = initialComposerValueRef.current;
    }
    requestAnimationFrame(() => mf.focus());

    return () => {
      if (mf.parentNode) mf.parentNode.removeChild(mf);
      composerMfRef.current = null;
    };
  }, [showComposer, mlReady]);

  const handleComposerSymbolInsert = useCallback((latex: string) => {
    const mf = composerMfRef.current;
    if (!mf?.executeCommand) return;
    mf.executeCommand(["insert", latex]);
    setComposerValue(mf.value);
    mf.focus();
  }, []);

  const handleComposerConfirm = useCallback(() => {
    if (composerValue.trim()) {
      insertAtCursor(`$${composerValue.trim()}$`);
    }
    setShowComposer(false);
    composerMfRef.current = null;
  }, [composerValue, insertAtCursor]);

  const handleComposerCancel = useCallback(() => {
    setShowComposer(false);
    composerMfRef.current = null;
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2">
        {/* 툴바 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowPalette((p) => !p)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  showPalette
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
                )}
              >
                fx 기호
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>자주 쓰는 수학 기호를 클릭 한 번으로 삽입합니다</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openComposer}
                className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"
              >
                수식 조립기
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>분수, 적분 등 복잡한 수식을 시각적으로 조립합니다</p>
            </TooltipContent>
          </Tooltip>

          <span className="ml-auto text-[11px] text-slate-400">
            텍스트 자유 입력 · 기호 버튼 클릭 시 수식 자동 삽입
          </span>
        </div>

        {/* 기호 팔레트 (원클릭 삽입) */}
        {showPalette && <SymbolPalette onInsert={handleSymbolInsert} compact />}

        {/* 수식 조립기 팝업 (MathLive WYSIWYG) */}
        {showComposer && (
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
              아래 편집기에서 수식을 만드세요. 기호를 클릭하거나 키보드로 입력한 뒤 <strong>"삽입"</strong>을 누르면 본문에 추가됩니다.
            </p>
            <SymbolPalette onInsert={handleComposerSymbolInsert} compact raw />
            <div ref={composerContainerRef} className="mt-2" />
            {composerValue && (
              <div className="mt-2 rounded bg-white p-2 text-center dark:bg-slate-900">
                <KatexRenderer latex={composerValue} displayMode className="text-base" />
              </div>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleComposerCancel}
                className="rounded-md px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleComposerConfirm}
                disabled={!composerValue.trim()}
                className="rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-40"
              >
                삽입
              </button>
            </div>
          </div>
        )}

        {/* 메인 textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder={"다음 방정식 의 근을 구하시오.\n↑ 텍스트 타이핑 후, [fx 기호] 또는 [수식 조립기]로 수식 삽입"}
          rows={4}
          spellCheck={false}
          className="resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
            dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        {/* 미리보기 */}
        {content.trim() && (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">미리보기</p>
            <KatexRenderer latex={content} displayMode className="text-sm" />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

export { BodyBlock };
