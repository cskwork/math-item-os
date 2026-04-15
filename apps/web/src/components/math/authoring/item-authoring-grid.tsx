"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { useSortable } from "@dnd-kit/react/sortable";
import { AuthoringToolbar } from "./authoring-toolbar";
import { BodyBlock } from "./blocks/body-block";
import { ChoicesBlock } from "./blocks/choices-block";
import { TableBlock } from "./blocks/table-block";
import { ImageBlock } from "./blocks/image-block";
import { SolutionBlock } from "./blocks/solution-block";
import { CodeBlock } from "./blocks/code-block";
import { OutputBlock } from "./blocks/output-block";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { useAuthoringState } from "./use-authoring-state";
import type { AuthoringBlock, AuthoringBlockType, AuthoringOutput } from "./types";

// --- 블록 타입 → 한국어 라벨 ---

const BLOCK_LABELS: Record<AuthoringBlockType, string> = {
  body: "문제 본문",
  choices: "선택지",
  table: "표",
  image: "이미지",
  solution: "풀이",
  code: "코드",
  output: "실행 결과",
};

// --- 드래그 가능한 블록 래퍼 ---

interface SortableBlockProps {
  readonly block: AuthoringBlock;
  readonly index: number;
  readonly isSelected: boolean;
  readonly editorMode: "visual" | "latex";
  readonly onSelect: (id: string | null) => void;
  readonly onRemove: (id: string) => void;
  readonly onUpdate: (id: string, patch: Partial<AuthoringBlock>) => void;
}

function SortableBlock({ block, index, isSelected, editorMode, onSelect, onRemove, onUpdate }: SortableBlockProps) {
  const { ref } = useSortable({ id: block.id, index });

  return (
    <div
      ref={ref}
      onClick={() => onSelect(block.id)}
      className={`group relative rounded-lg border bg-white p-4 transition-all dark:bg-slate-900 ${
        isSelected
          ? "border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      }`}
    >
      {/* 블록 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 드래그 핸들 */}
          <span className="cursor-grab text-slate-300 active:cursor-grabbing dark:text-slate-600" title="드래그하여 이동">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          </span>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {BLOCK_LABELS[block.type]}
          </span>
        </div>

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
          className="invisible text-slate-300 transition-colors hover:text-red-500 group-hover:visible dark:text-slate-600"
          title="블록 삭제"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      {/* 블록 콘텐츠 */}
      {renderBlockContent(block, editorMode, onUpdate)}
    </div>
  );
}

function renderBlockContent(
  block: AuthoringBlock,
  editorMode: "visual" | "latex",
  onUpdate: (id: string, patch: Partial<AuthoringBlock>) => void,
) {
  switch (block.type) {
    case "body":
      return <BodyBlock block={block} editorMode={editorMode} onUpdate={onUpdate} />;
    case "choices":
      return <ChoicesBlock block={block} editorMode={editorMode} onUpdate={onUpdate} />;
    case "table":
      return <TableBlock block={block} editorMode={editorMode} onUpdate={onUpdate} />;
    case "image":
      return <ImageBlock block={block} onUpdate={onUpdate} />;
    case "solution":
      return <SolutionBlock block={block} editorMode={editorMode} onUpdate={onUpdate} />;
    case "code":
      return <CodeBlock block={block} onUpdate={onUpdate} />;
    case "output":
      return <OutputBlock block={block} onUpdate={onUpdate} />;
  }
}

// --- 미리보기 패널 ---

function PreviewPanel({ output }: { readonly output: AuthoringOutput }) {
  const hasContent = output.bodyLatex.trim() || output.choices?.length || output.bodyCode || output.bodyText;
  if (!hasContent) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        블록을 추가하면 미리보기가 표시됩니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 텍스트 본문 미리보기 (IT 자격증) */}
      {output.bodyText?.trim() && (
        <div className="rounded-md border border-slate-100 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          {output.bodyText}
        </div>
      )}

      {/* LaTeX 본문 미리보기 (수학) */}
      {output.bodyLatex.trim() && (
        <div className="rounded-md border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <KatexRenderer latex={output.bodyLatex} displayMode className="text-base" />
        </div>
      )}

      {/* 코드 미리보기 (IT 자격증) */}
      {output.bodyCode?.trim() && (
        <div className="rounded-md border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">{output.codeLanguage ?? "CODE"}</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">{output.bodyCode}</pre>
        </div>
      )}

      {/* 예상 출력 미리보기 */}
      {output.expectedOutput?.trim() && (
        <div className="rounded-md border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
          <div className="mb-1 text-xs font-medium text-slate-500">출력</div>
          <pre className="font-mono text-sm whitespace-pre-wrap">{output.expectedOutput}</pre>
        </div>
      )}

      {/* 선택지 미리보기 */}
      {output.choices && output.choices.length > 0 && (
        <div className="flex flex-col gap-2">
          {output.choices.map((c, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                c.isCorrect
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <span className="font-medium">{c.label}</span>
              {c.latex ? (
                <KatexRenderer latex={c.latex} />
              ) : (
                <span className="text-slate-400">(비어 있음)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 이미지 미리보기 */}
      {output.imageUrls.map((url, i) => (
        <img key={i} src={url} alt="" className="max-h-[200px] rounded-md object-contain" />
      ))}
    </div>
  );
}

// --- 메인 컴포넌트 ---

interface ItemAuthoringGridProps {
  /** 외부에서 저작 결과를 받을 콜백 */
  readonly onOutputChange?: (output: AuthoringOutput) => void;
  /** 편집 모드 — 기존 본문 LaTeX를 초기 body 블록에 로드 */
  readonly initialBodyLatex?: string;
  /** 과목 — 블록 팔레트 결정 */
  readonly subject?: "MATH" | "IT_CERT" | "ENGLISH";
}

function ItemAuthoringGrid({ onOutputChange, initialBodyLatex, subject = "MATH" }: ItemAuthoringGridProps) {
  const initialBlocks = useMemo(
    () => initialBodyLatex
      ? [{ id: "auth-init-body", type: "body" as const, position: 0, latex: initialBodyLatex, text: "" }]
      : undefined,
    [initialBodyLatex],
  );

  const {
    state,
    addBlock,
    removeBlock,
    moveBlock,
    updateBlock,
    selectBlock,
    toggleEditorMode,
    toOutput,
  } = useAuthoringState({ initialBlocks });

  const output = toOutput();

  // DnD 이벤트
  const handleDragOver = useCallback(
    (event: any) => {
      const { source, target } = event.operation;
      if (!source || !target) return;
      const fromIdx = state.blocks.findIndex((b) => b.id === source.id);
      const toIdx = state.blocks.findIndex((b) => b.id === target.id);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        moveBlock(fromIdx, toIdx);
      }
    },
    [state.blocks, moveBlock],
  );

  // 출력 변경 알림 — useEffect로 렌더 후에 호출 (render-during-render 방지)
  const onOutputChangeRef = useRef(onOutputChange);
  onOutputChangeRef.current = onOutputChange;
  const outputBodyLatex = output.bodyLatex;
  const outputChoicesLen = output.choices?.length ?? 0;
  const outputImgLen = output.imageUrls.length;
  const outputBodyCode = output.bodyCode;
  const outputExpectedOutput = output.expectedOutput;

  useEffect(() => {
    onOutputChangeRef.current?.(output);
    // output 전체가 아닌 핵심 값만 의존성으로 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputBodyLatex, outputChoicesLen, outputImgLen, outputBodyCode, outputExpectedOutput]);

  return (
    <div className="flex flex-col gap-4">
      {/* 툴바 */}
      <AuthoringToolbar
        editorMode={state.editorMode}
        onAddBlock={addBlock}
        onToggleMode={toggleEditorMode}
        subject={subject}
      />

      {/* 에디터 + 미리보기 2단 레이아웃 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 좌: 블록 편집 영역 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">편집</h3>
          <DragDropProvider onDragOver={handleDragOver}>
            <div className="flex flex-col gap-2">
              {state.blocks.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  isSelected={state.selectedBlockId === block.id}
                  editorMode={state.editorMode}
                  onSelect={selectBlock}
                  onRemove={removeBlock}
                  onUpdate={updateBlock}
                />
              ))}
            </div>
          </DragDropProvider>

          {state.blocks.length === 0 && (
            <div className="flex h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
              위 툴바에서 블록을 추가하세요
            </div>
          )}
        </div>

        {/* 우: 실시간 미리보기 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">미리보기</h3>
          <div className="min-h-[200px] rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <PreviewPanel output={output} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { ItemAuthoringGrid };
export type { ItemAuthoringGridProps };
