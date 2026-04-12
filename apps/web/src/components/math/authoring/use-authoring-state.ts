import { useState, useCallback } from "react";
import type { AuthoringBlock, AuthoringBlockType, AuthoringState, ChoiceItem, TableData, AuthoringOutput } from "./types";

// --- 블록 ID 생성 ---

let blockCounter = 0;

function generateBlockId(): string {
  blockCounter += 1;
  return `auth-${Date.now()}-${blockCounter}`;
}

// --- 기본 선택지 ---

const DEFAULT_CHOICES: ReadonlyArray<ChoiceItem> = [
  { label: "①", latex: "", isCorrect: false },
  { label: "②", latex: "", isCorrect: false },
  { label: "③", latex: "", isCorrect: false },
  { label: "④", latex: "", isCorrect: false },
  { label: "⑤", latex: "", isCorrect: false },
];

// --- 기본 표 ---

const DEFAULT_TABLE: TableData = {
  rows: 3,
  cols: 3,
  cells: [["", "", ""], ["", "", ""], ["", "", ""]],
  hasHeader: true,
};

// --- 블록 초기값 팩토리 ---

function createBlock(type: AuthoringBlockType, position: number): AuthoringBlock {
  const id = generateBlockId();
  const base = { id, type, position };

  switch (type) {
    case "body":
      return { ...base, latex: "", text: "" };
    case "choices":
      return { ...base, choices: DEFAULT_CHOICES };
    case "image":
      return { ...base, imageUrl: "", imageAlt: "" };
    case "table":
      return { ...base, table: DEFAULT_TABLE };
    case "solution":
      return { ...base, solutionLatex: "" };
  }
}

// --- 훅 ---

interface UseAuthoringStateOptions {
  readonly initialBlocks?: ReadonlyArray<AuthoringBlock>;
}

export function useAuthoringState(options?: UseAuthoringStateOptions) {
  const [state, setState] = useState<AuthoringState>(() => ({
    blocks: options?.initialBlocks ?? [createBlock("body", 0)],
    selectedBlockId: null,
    editorMode: "visual",
  }));

  /** 블록 추가 */
  const addBlock = useCallback((type: AuthoringBlockType) => {
    setState((prev) => {
      const position = prev.blocks.length;
      const newBlock = createBlock(type, position);
      return {
        ...prev,
        blocks: [...prev.blocks, newBlock],
        selectedBlockId: newBlock.id,
      };
    });
  }, []);

  /** 블록 삭제 */
  const removeBlock = useCallback((blockId: string) => {
    setState((prev) => {
      const filtered = prev.blocks.filter((b) => b.id !== blockId);
      const reindexed = filtered.map((b, i) => (b.position === i ? b : { ...b, position: i }));
      return {
        ...prev,
        blocks: reindexed,
        selectedBlockId: prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
      };
    });
  }, []);

  /** 블록 이동 (DnD) */
  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      if (fromIndex === toIndex) return prev;
      const arr = [...prev.blocks];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      const reindexed = arr.map((b, i) => ({ ...b, position: i }));
      return { ...prev, blocks: reindexed };
    });
  }, []);

  /** 블록 업데이트 (partial patch) */
  const updateBlock = useCallback((blockId: string, patch: Partial<AuthoringBlock>) => {
    setState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  }, []);

  /** 블록 선택 */
  const selectBlock = useCallback((blockId: string | null) => {
    setState((prev) => ({ ...prev, selectedBlockId: blockId }));
  }, []);

  /** 에디터 모드 토글 */
  const toggleEditorMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      editorMode: prev.editorMode === "visual" ? "latex" : "visual",
    }));
  }, []);

  /** 블록 → 제출용 결과 변환 */
  const toOutput = useCallback((): AuthoringOutput => {
    const bodyParts: string[] = [];
    let choices: ReadonlyArray<ChoiceItem> | undefined;
    const imageUrls: string[] = [];

    for (const block of state.blocks) {
      switch (block.type) {
        case "body": {
          // latex 필드에 혼합 콘텐츠 저장 (한국어 + $...$LaTeX)
          if (block.latex?.trim()) bodyParts.push(block.latex.trim());
          break;
        }
        case "choices":
          choices = block.choices;
          break;
        case "image":
          if (block.imageUrl) imageUrls.push(block.imageUrl);
          break;
        case "table": {
          if (!block.table) break;
          const { cells, hasHeader } = block.table;
          const rows = cells.map((row) => row.map((c) => c || " ").join(" & ")).map((r) => r + " \\\\");
          if (hasHeader && rows.length > 0) {
            rows.splice(1, 0, "\\hline");
          }
          bodyParts.push(`\\begin{array}{${"c".repeat(block.table.cols)}}\n${rows.join("\n")}\n\\end{array}`);
          break;
        }
        case "solution":
          if (block.solutionLatex?.trim()) {
            bodyParts.push(`\\text{[풀이]} ${block.solutionLatex.trim()}`);
          }
          break;
      }
    }

    return {
      bodyLatex: bodyParts.join("\n\n"),
      choices,
      imageUrls,
    };
  }, [state.blocks]);

  return {
    state,
    addBlock,
    removeBlock,
    moveBlock,
    updateBlock,
    selectBlock,
    toggleEditorMode,
    toOutput,
  };
}
