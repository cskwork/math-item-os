// MathAuthoringPopup 전용 타입

export interface MathAuthoringPopupProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initialLatex?: string;
  readonly onConfirm: (latex: string) => void;
}

export type ActivePanel = "symbols" | "templates" | "source" | null;
export type ActiveTab = "formula" | "chart";
export type GeoGebraMode = "graphing" | "geometry" | "classic";

export interface PopupState {
  readonly latex: string;
  readonly undoStack: readonly string[];
  readonly redoStack: readonly string[];
  readonly activePanel: ActivePanel;
  readonly activeTab: ActiveTab;
  readonly commandPaletteOpen: boolean;
}

export type PopupAction =
  | { type: "SET_LATEX"; latex: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "TOGGLE_PANEL"; panel: ActivePanel }
  | { type: "SET_TAB"; tab: ActiveTab }
  | { type: "SET_COMMAND_PALETTE"; open: boolean }
  | { type: "RESET"; initialLatex: string };

export type TemplateCategory =
  | "algebra"
  | "geometry"
  | "trigonometry"
  | "calculus"
  | "statistics"
  | "exam_patterns";

export interface FormulaTemplate {
  readonly id: string;
  readonly label: string;
  readonly latex: string;
  readonly category: TemplateCategory;
  readonly tags: readonly string[];
}
