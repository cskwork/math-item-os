// ─── 블록 타입 ───

export type BlockType = "math_item" | "text" | "divider";

// ─── 캔버스 블록 ───

export interface CanvasBlock {
  readonly id: string;
  readonly type: BlockType;
  readonly position: number;
  readonly column: number;
  readonly width: number;
  // math_item 전용
  readonly itemId?: string;
  readonly points?: number;
  readonly item?: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly difficultyAuthor?: number | null;
    readonly itemType?: string;
    readonly skills?: ReadonlyArray<{
      readonly skill: { readonly title: string };
    }>;
  };
  // text / image 블록 전용
  readonly content?: {
    readonly text?: string;
    readonly latex?: string;
  };
}

// ─── 레이아웃 설정 ───

export interface LayoutConfig {
  readonly columns: 1 | 2;
  readonly pageSize: "a4" | "letter";
  readonly showItemNumbers: boolean;
  readonly showPoints: boolean;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  columns: 1,
  pageSize: "a4",
  showItemNumbers: true,
  showPoints: true,
};

// ─── 캔버스 상태 ───

export interface CanvasState {
  readonly blocks: ReadonlyArray<CanvasBlock>;
  readonly layout: LayoutConfig;
  readonly selectedBlockId: string | null;
}
