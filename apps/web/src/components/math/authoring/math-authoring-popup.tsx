"use client";

import { useEffect, useRef, useCallback, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MathAuthoringPopupProps } from "./popup-types";
import { usePopupState } from "./use-popup-state";
import { SearchSymbolPalette } from "./search-symbol-palette";
import { TemplateLibrary } from "./template-library";
import { LatexSourceEditor } from "./latex-source-editor";
import { PopupPreviewPanel } from "./popup-preview-panel";
import { CommandPalette } from "./command-palette";
import { GeoGebraPanel } from "./geogebra-panel";

function MathAuthoringPopup({
  open,
  onOpenChange,
  initialLatex = "",
  onConfirm,
}: MathAuthoringPopupProps) {
  const { state, dispatch, setLatex, undo, redo, reset } = usePopupState(initialLatex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandFilterRef = useRef("");

  // 팝업 열릴 때 초기화
  useEffect(() => {
    if (open) {
      reset(initialLatex);
      commandFilterRef.current = "";
    }
  }, [open, initialLatex, reset]);

  // --- 기호/템플릿 삽입 ---
  const insertAtCursor = useCallback(
    (latex: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setLatex(state.latex + latex);
        return;
      }
      const { selectionStart, selectionEnd } = textarea;
      const before = state.latex.slice(0, selectionStart);
      const after = state.latex.slice(selectionEnd);
      setLatex(before + latex + after);

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = selectionStart + latex.length;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [state.latex, setLatex],
  );

  // --- 커맨드 팔레트 삽입 ---
  const handleCommandInsert = useCallback(
    (latex: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setLatex(state.latex + latex);
        dispatch({ type: "SET_COMMAND_PALETTE", open: false });
        return;
      }
      // 백슬래시 + 필터 텍스트 제거 후 삽입
      const { selectionStart } = textarea;
      const filterLen = commandFilterRef.current.length + 1; // +1 for backslash
      const before = state.latex.slice(0, selectionStart - filterLen);
      const after = state.latex.slice(selectionStart);
      setLatex(before + latex + after);
      dispatch({ type: "SET_COMMAND_PALETTE", open: false });
      commandFilterRef.current = "";

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = before.length + latex.length;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [state.latex, setLatex, dispatch],
  );

  // --- textarea 입력 ---
  const handleTextareaChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLatex(newValue);

      // 백슬래시 감지 → 커맨드 팔레트
      const cursor = e.target.selectionStart;
      const textBeforeCursor = newValue.slice(0, cursor);
      const lastBackslash = textBeforeCursor.lastIndexOf("\\");

      if (lastBackslash >= 0) {
        const afterBackslash = textBeforeCursor.slice(lastBackslash + 1);
        // 스페이스나 중괄호가 없으면 아직 타이핑 중
        if (!/[\s{}]/.test(afterBackslash)) {
          commandFilterRef.current = afterBackslash;
          dispatch({ type: "SET_COMMAND_PALETTE", open: true });
          return;
        }
      }
      dispatch({ type: "SET_COMMAND_PALETTE", open: false });
      commandFilterRef.current = "";
    },
    [setLatex, dispatch],
  );

  // --- 키보드 단축키 ---
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        onConfirm(state.latex);
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, state.latex, undo, redo, onConfirm, onOpenChange]);

  // --- 닫기 확인 ---
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && state.latex !== initialLatex) {
        if (!window.confirm("변경사항을 버리시겠습니까?")) return;
      }
      onOpenChange(next);
    },
    [state.latex, initialLatex, onOpenChange],
  );

  // --- 확인 ---
  const handleConfirm = useCallback(() => {
    onConfirm(state.latex);
    onOpenChange(false);
  }, [state.latex, onConfirm, onOpenChange]);

  // --- GeoGebra 이미지 내보내기 ---
  const handleGeoGebraExport = useCallback(
    (dataUrl: string) => {
      // 수식 탭으로 전환하고 이미지 URL을 텍스트로 삽입 (별도 이미지 지원 시 확장 가능)
      dispatch({ type: "SET_TAB", tab: "formula" });
      insertAtCursor(`\\includegraphics{${dataUrl}}`);
    },
    [dispatch, insertAtCursor],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[95vh] w-[95vw] max-w-[1600px] flex-col gap-0 p-0 sm:max-w-[1600px]">
        {/* 헤더 */}
        <DialogHeader className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <DialogTitle>수식 저작도구</DialogTitle>
          <DialogDescription className="sr-only">
            수식 편집, 기호 삽입, 템플릿, GeoGebra 차트를 지원합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 탭 헤더 */}
        <div className="flex gap-1 border-b border-slate-200 px-6 py-2 dark:border-slate-700">
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_TAB", tab: "formula" })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              state.activeTab === "formula"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            수식 편집
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_TAB", tab: "chart" })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              state.activeTab === "chart"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            차트/그래프
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-hidden px-6 py-4">
          {state.activeTab === "formula" ? (
            <div className="flex h-full flex-col gap-3">
              {/* 툴바 */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={state.undoStack.length === 0}
                    title="실행 취소 (Ctrl+Z)"
                  >
                    ↩
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={redo}
                    disabled={state.redoStack.length === 0}
                    title="다시 실행 (Ctrl+Shift+Z)"
                  >
                    ↪
                  </Button>
                </div>

                <div className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700" />

                {/* 패널 토글 */}
                {(["symbols", "templates", "source"] as const).map((panel) => (
                  <Button
                    key={panel}
                    type="button"
                    variant={state.activePanel === panel ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => dispatch({ type: "TOGGLE_PANEL", panel })}
                  >
                    {{ symbols: "기호", templates: "템플릿", source: "소스" }[panel]}
                  </Button>
                ))}
              </div>

              {/* 에디터 + 사이드 패널 */}
              <div className="flex flex-1 gap-3 overflow-hidden">
                {/* 메인 textarea */}
                <div className="relative flex flex-1 flex-col">
                  <textarea
                    ref={textareaRef}
                    value={state.latex}
                    onChange={handleTextareaChange}
                    spellCheck={false}
                    placeholder="LaTeX 수식을 입력하세요. 백슬래시(\)로 커맨드 팔레트를 열 수 있습니다."
                    className="flex-1 resize-none rounded-md border border-slate-200 bg-white p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {/* 커맨드 팔레트 */}
                  <CommandPalette
                    open={state.commandPaletteOpen}
                    onClose={() => dispatch({ type: "SET_COMMAND_PALETTE", open: false })}
                    onInsert={handleCommandInsert}
                    filter={commandFilterRef.current}
                  />
                </div>

                {/* 사이드 패널 */}
                {state.activePanel && (
                  <div className="w-96 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                    {state.activePanel === "symbols" && (
                      <SearchSymbolPalette onInsert={insertAtCursor} />
                    )}
                    {state.activePanel === "templates" && (
                      <TemplateLibrary onInsert={insertAtCursor} />
                    )}
                    {state.activePanel === "source" && (
                      <LatexSourceEditor value={state.latex} onChange={setLatex} />
                    )}
                  </div>
                )}
              </div>

              {/* 미리보기 */}
              <PopupPreviewPanel latex={state.latex} />
            </div>
          ) : (
            <GeoGebraPanel onExportImage={handleGeoGebraExport} />
          )}
        </div>

        {/* 푸터 */}
        <DialogFooter className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button type="button" onClick={handleConfirm}>
            삽입
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MathAuthoringPopup };
export type { MathAuthoringPopupProps };
