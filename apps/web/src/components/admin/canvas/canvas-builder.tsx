"use client";

import { useCallback, useMemo } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { ComponentPalette } from "./component-palette";
import { CanvasToolbar } from "./canvas-toolbar";
import { BlockWrapper } from "./blocks/block-wrapper";
import { MathItemBlock } from "./blocks/math-item-block";
import { TextBlock } from "./blocks/text-block";
import { DividerBlock } from "./blocks/divider-block";
import type { BlockType, CanvasBlock, LayoutConfig } from "./types";

type DragEndHandler = NonNullable<
  React.ComponentProps<typeof DragDropProvider>["onDragEnd"]
>;
type DragEndEventArg = Parameters<DragEndHandler>[0];

// ─── Props ───

interface CanvasBuilderProps {
  readonly blocks: ReadonlyArray<CanvasBlock>;
  readonly layout: LayoutConfig;
  readonly selectedBlockId: string | null;
  readonly onAddBlock: (type: BlockType) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  readonly onMoveBlock: (fromIndex: number, toIndex: number) => void;
  readonly onUpdateBlock: (
    blockId: string,
    patch: Partial<Pick<CanvasBlock, "content" | "points">>,
  ) => void;
  readonly onSelectBlock: (blockId: string | null) => void;
  readonly onLayoutChange: (patch: Partial<LayoutConfig>) => void;
}

export function CanvasBuilder({
  blocks,
  layout,
  selectedBlockId,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onUpdateBlock,
  onSelectBlock,
  onLayoutChange,
}: CanvasBuilderProps) {
  // ── DnD ──

  const handleDragEnd = useCallback(
    (event: DragEndEventArg) => {
      if (event.canceled) return;

      const { source } = event.operation;
      if (!source || !isSortable(source)) return;
      if (!("initialIndex" in source)) return;

      const fromIndex = source.initialIndex as number;
      const toIndex = source.index;
      onMoveBlock(fromIndex, toIndex);
    },
    [onMoveBlock],
  );

  // ── 문항 번호 매핑 ──

  const mathItemIndex = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;
    for (const block of blocks) {
      if (block.type === "math_item") {
        map.set(block.id, counter);
        counter += 1;
      }
    }
    return map;
  }, [blocks]);

  // ── 블록 렌더링 ──

  const renderBlockContent = useCallback(
    (block: CanvasBlock) => {
      switch (block.type) {
        case "math_item":
          return (
            <MathItemBlock
              block={block}
              showNumber={
                layout.showItemNumbers
                  ? mathItemIndex.get(block.id)
                  : undefined
              }
              showPoints={layout.showPoints}
              onPointsChange={(points) => onUpdateBlock(block.id, { points })}
            />
          );
        case "text":
          return (
            <TextBlock
              block={block}
              onContentChange={(text) =>
                onUpdateBlock(block.id, { content: { text } })
              }
            />
          );
        case "divider":
          return <DividerBlock />;
        default:
          return null;
      }
    },
    [layout, mathItemIndex, onUpdateBlock],
  );

  // ── 집계 ──

  const stats = useMemo(() => {
    const mathBlocks = blocks.filter((b) => b.type === "math_item");
    return {
      totalItems: mathBlocks.length,
      totalPoints: mathBlocks.reduce((sum, b) => sum + (b.points ?? 10), 0),
      totalBlocks: blocks.length,
    };
  }, [blocks]);

  const gridClassName =
    layout.columns === 2
      ? "grid grid-cols-2 gap-2"
      : "space-y-2";

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-800">
            학습지 캔버스{" "}
            <span className="font-normal text-slate-500">
              ({stats.totalItems}문항, {stats.totalBlocks}블록, 총{" "}
              {stats.totalPoints}점)
            </span>
          </h3>
          <CanvasToolbar layout={layout} onLayoutChange={onLayoutChange} />
        </div>
        <ComponentPalette onAddBlock={onAddBlock} />
      </div>

      {/* 캔버스 영역 */}
      {blocks.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
          <div className="text-center">
            <p className="text-sm text-slate-400">
              아래에서 문항을 추천/검색하여 추가하거나
            </p>
            <p className="text-sm text-slate-400">
              상단 팔레트에서 텍스트/구분선 블록을 추가하세요
            </p>
          </div>
        </div>
      ) : (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className={gridClassName}>
            {blocks.map((block, index) => (
              <BlockWrapper
                key={block.id}
                id={block.id}
                index={index}
                isSelected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
                onRemove={() => onRemoveBlock(block.id)}
              >
                {renderBlockContent(block)}
              </BlockWrapper>
            ))}
          </div>
        </DragDropProvider>
      )}

      {/* 요약 */}
      {blocks.length > 0 && (
        <div className="flex items-center justify-end border-t border-slate-200 pt-3">
          <span className="text-sm font-medium text-slate-700">
            합계: {stats.totalItems}문항 / {stats.totalPoints}점
          </span>
        </div>
      )}
    </div>
  );
}
