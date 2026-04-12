// 수학 문항 저작 도구 — 타입 정의

/** 저작 그리드 블록 유형 */
export type AuthoringBlockType =
  | "body"        // 문제 본문 (텍스트+수식)
  | "choices"     // 선택지 (객관식)
  | "image"       // 이미지
  | "table"       // 표
  | "solution";   // 풀이 과정

/** 선택지 하나 */
export interface ChoiceItem {
  readonly label: string;      // "①", "②", ...
  readonly latex: string;      // LaTeX 내용
  readonly isCorrect: boolean;
}

/** 표 데이터 */
export interface TableData {
  readonly rows: number;
  readonly cols: number;
  readonly cells: ReadonlyArray<ReadonlyArray<string>>; // [row][col] LaTeX
  readonly hasHeader: boolean;
}

/** 저작 그리드 블록 */
export interface AuthoringBlock {
  readonly id: string;
  readonly type: AuthoringBlockType;
  readonly position: number;

  // body
  readonly latex?: string;
  readonly text?: string; // 일반 텍스트 (한국어 지문 등)

  // choices
  readonly choices?: ReadonlyArray<ChoiceItem>;

  // image
  readonly imageUrl?: string;
  readonly imageAlt?: string;

  // table
  readonly table?: TableData;

  // solution
  readonly solutionLatex?: string;
}

/** 저작 상태 */
export interface AuthoringState {
  readonly blocks: ReadonlyArray<AuthoringBlock>;
  readonly selectedBlockId: string | null;
  readonly editorMode: "visual" | "latex"; // 수식 입력 모드 토글
}

/** 저작 결과 — 폼 제출에 사용 */
export interface AuthoringOutput {
  readonly bodyLatex: string;       // 블록에서 추출한 전체 LaTeX
  readonly choices?: ReadonlyArray<ChoiceItem>;
  readonly imageUrls: readonly string[];
}

// MathLive 글로벌 타입은 math-field.d.ts 참조
