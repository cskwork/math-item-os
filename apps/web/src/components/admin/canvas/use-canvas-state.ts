import { useCallback, useState } from "react";
import type { BlockType, CanvasBlock, CanvasState, LayoutConfig } from "./types";
import { DEFAULT_LAYOUT } from "./types";

let blockIdCounter = 0;
function generateBlockId(): string {
  blockIdCounter += 1;
  return `block-${Date.now()}-${blockIdCounter}`;
}

function recalculatePositions(
  blocks: ReadonlyArray<CanvasBlock>,
): ReadonlyArray<CanvasBlock> {
  return blocks.map((block, index) => ({
    ...block,
    position: index,
  }));
}

interface UseCanvasStateOptions {
  readonly initialBlocks?: ReadonlyArray<CanvasBlock>;
  readonly initialLayout?: LayoutConfig;
}

export function useCanvasState(options: UseCanvasStateOptions = {}) {
  const [state, setState] = useState<CanvasState>({
    blocks: options.initialBlocks ?? [],
    layout: options.initialLayout ?? DEFAULT_LAYOUT,
    selectedBlockId: null,
  });

  // ── 블록 추가 ──

  const addBlock = useCallback(
    (type: BlockType, insertAt?: number) => {
      setState((prev) => {
        const newBlock: CanvasBlock = {
          id: generateBlockId(),
          type,
          position: 0,
          column: 0,
          width: 1,
          ...(type === "text" ? { content: { text: "" } } : {}),
        };

        const mutable = [...prev.blocks];
        const index = insertAt ?? mutable.length;
        mutable.splice(index, 0, newBlock);

        return {
          ...prev,
          blocks: recalculatePositions(mutable),
          selectedBlockId: newBlock.id,
        };
      });
    },
    [],
  );

  // ── 수학 문항 블록 추가 ──

  const addMathItemBlock = useCallback(
    (item: NonNullable<CanvasBlock["item"]>, points: number = 10) => {
      setState((prev) => {
        // 중복 방지
        if (prev.blocks.some((b) => b.itemId === item.id)) return prev;

        const newBlock: CanvasBlock = {
          id: generateBlockId(),
          type: "math_item",
          position: 0,
          column: 0,
          width: 1,
          itemId: item.id,
          item,
          points,
        };

        const updated = [...prev.blocks, newBlock];
        return {
          ...prev,
          blocks: recalculatePositions(updated),
        };
      });
    },
    [],
  );

  // ── 블록 삭제 ──

  const removeBlock = useCallback(
    (blockId: string) => {
      setState((prev) => {
        const filtered = prev.blocks.filter((b) => b.id !== blockId);
        return {
          ...prev,
          blocks: recalculatePositions(filtered),
          selectedBlockId:
            prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
        };
      });
    },
    [],
  );

  // ── 블록 이동 (DnD) ──

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      setState((prev) => {
        if (fromIndex === toIndex) return prev;

        const mutable = [...prev.blocks];
        const [removed] = mutable.splice(fromIndex, 1);
        mutable.splice(toIndex, 0, removed);

        return {
          ...prev,
          blocks: recalculatePositions(mutable),
        };
      });
    },
    [],
  );

  // ── 블록 업데이트 ──

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<Pick<CanvasBlock, "content" | "points">>) => {
      setState((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === blockId ? { ...b, ...patch } : b,
        ),
      }));
    },
    [],
  );

  // ── 선택 ──

  const selectBlock = useCallback(
    (blockId: string | null) => {
      setState((prev) => ({
        ...prev,
        selectedBlockId: blockId,
      }));
    },
    [],
  );

  // ── 레이아웃 변경 ──

  const setLayout = useCallback(
    (patch: Partial<LayoutConfig>) => {
      setState((prev) => ({
        ...prev,
        layout: { ...prev.layout, ...patch },
      }));
    },
    [],
  );

  // ── 직렬화 (저장용) ──

  const toSavePayload = useCallback(() => {
    const mathBlocks = state.blocks.filter((b) => b.type === "math_item");
    return {
      itemIds: mathBlocks.map((b) => b.itemId!),
      points: mathBlocks.map((b) => b.points ?? 10),
      layout: state.layout,
    };
  }, [state.blocks, state.layout]);

  return {
    blocks: state.blocks,
    layout: state.layout,
    selectedBlockId: state.selectedBlockId,
    addBlock,
    addMathItemBlock,
    removeBlock,
    moveBlock,
    updateBlock,
    selectBlock,
    setLayout,
    toSavePayload,
  };
}
