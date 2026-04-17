"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  type ChangeEvent,
} from "react";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// --- 타입 정의 ---

interface FormulaEditorProps {
  /** LaTeX 문자열 */
  readonly value: string;
  /** LaTeX 변경 콜백 */
  readonly onChange: (value: string) => void;
  /** 라벨 텍스트 */
  readonly label?: string;
  /** textarea placeholder */
  readonly placeholder?: string;
  /** KaTeX display 모드 (기본: true) */
  readonly displayMode?: boolean;
  /** 폼 유효성 에러 메시지 */
  readonly error?: string;
  /** 추가 CSS 클래스 */
  readonly className?: string;
}

// --- 수학 기호 상수 ---

interface MathSymbol {
  /** 삽입할 LaTeX 문자열 */
  readonly latex: string;
  /** 버튼 표시 텍스트 */
  readonly display: string;
  /** 툴팁 설명 (한국어) */
  readonly tooltip: string;
  /** 삽입 후 커서 오프셋 ('{' 안으로 이동하기 위함) */
  readonly cursorOffset: number;
}

const MATH_SYMBOLS: readonly MathSymbol[] = [
  { latex: "\\frac{}{}", display: "a/b", tooltip: "분수", cursorOffset: 6 },
  { latex: "\\sqrt{}", display: "sqrt", tooltip: "제곱근", cursorOffset: 6 },
  { latex: "^{}", display: "x^n", tooltip: "위첨자", cursorOffset: 2 },
  { latex: "_{}", display: "x_n", tooltip: "아래첨자", cursorOffset: 2 },
  { latex: "\\pm", display: "+-", tooltip: "플러스마이너스", cursorOffset: 3 },
  { latex: "\\times", display: "x", tooltip: "곱하기", cursorOffset: 6 },
  { latex: "\\div", display: "/", tooltip: "나누기", cursorOffset: 4 },
  { latex: "\\leq", display: "<=", tooltip: "이하", cursorOffset: 4 },
  { latex: "\\geq", display: ">=", tooltip: "이상", cursorOffset: 4 },
  { latex: "\\neq", display: "!=", tooltip: "같지 않음", cursorOffset: 4 },
  { latex: "\\alpha", display: "alpha", tooltip: "알파", cursorOffset: 6 },
  { latex: "\\beta", display: "beta", tooltip: "베타", cursorOffset: 5 },
  { latex: "\\theta", display: "theta", tooltip: "세타", cursorOffset: 6 },
  { latex: "\\pi", display: "pi", tooltip: "파이", cursorOffset: 3 },
  { latex: "\\sin", display: "sin", tooltip: "사인", cursorOffset: 4 },
  { latex: "\\cos", display: "cos", tooltip: "코사인", cursorOffset: 4 },
  { latex: "\\tan", display: "tan", tooltip: "탄젠트", cursorOffset: 4 },
  { latex: "\\sum_{i=1}^{n}", display: "sum", tooltip: "합", cursorOffset: 14 },
  { latex: "\\int_{a}^{b}", display: "int", tooltip: "적분", cursorOffset: 12 },
  { latex: "\\lim_{x \\to \\infty}", display: "lim", tooltip: "극한", cursorOffset: 19 },
  { latex: "\\infty", display: "inf", tooltip: "무한대", cursorOffset: 6 },
  { latex: "\\left| \\right|", display: "|x|", tooltip: "절대값", cursorOffset: 6 },
] as const;

// --- 디바운스 훅 ---

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

// --- 미리보기 컴포넌트 (memo로 불필요한 재렌더링 방지) ---

interface PreviewPanelProps {
  readonly latex: string;
  readonly displayMode: boolean;
}

const PreviewPanel = memo(function PreviewPanel({
  latex,
  displayMode,
}: PreviewPanelProps) {
  const [parseError, setParseError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // KaTeX 파싱 에러 감지를 위해 렌더링 후 에러 요소 확인
    if (!containerRef.current) return;

    const errorElement = containerRef.current.querySelector(
      ".katex-error",
    );
    if (errorElement) {
      setParseError(errorElement.getAttribute("title") ?? "수식 파싱 에러");
    } else {
      setParseError(null);
    }
  }, [latex]);

  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={containerRef}
        className={cn(
          "flex min-h-[120px] flex-1 items-center justify-center rounded-md border bg-white p-4 dark:bg-slate-900",
          parseError
            ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950"
            : "border-slate-200 dark:border-slate-700",
        )}
      >
        {latex.trim() ? (
          <KatexRenderer
            latex={latex}
            displayMode={displayMode}
            className="text-lg"
          />
        ) : (
          <span className="text-sm text-slate-400">
            미리보기가 여기에 표시됩니다
          </span>
        )}
      </div>
      {parseError && (
        <p className="mt-1 text-xs text-amber-600">{parseError}</p>
      )}
    </div>
  );
});

// --- 기호 툴바 컴포넌트 ---

interface SymbolToolbarProps {
  readonly onInsert: (symbol: MathSymbol) => void;
}

const SymbolToolbar = memo(function SymbolToolbar({
  onInsert,
}: SymbolToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {MATH_SYMBOLS.map((symbol) => (
        <Tooltip key={symbol.latex}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-[36px] px-2 font-mono text-xs"
              onClick={() => onInsert(symbol)}
            >
              {symbol.display}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {symbol.tooltip} ({symbol.latex})
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
});

// --- 메인 에디터 컴포넌트 ---

function FormulaEditor({
  value,
  onChange,
  label,
  placeholder = "LaTeX 수식을 입력하세요 (예: x^2 + y^2 = r^2)",
  displayMode = true,
  error,
  className,
}: FormulaEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedValue = useDebouncedValue(value, 300);

  // textarea 입력 핸들러
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  // 기호 삽입 핸들러 - 커서 위치에 삽입
  const handleInsertSymbol = useCallback(
    (symbol: MathSymbol) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd } = textarea;
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);
      const newValue = before + symbol.latex + after;

      onChange(newValue);

      // 다음 렌더 사이클에서 커서 위치 복원
      requestAnimationFrame(() => {
        textarea.focus();
        const newCursorPos = selectionStart + symbol.cursorOffset;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, onChange],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* 라벨 */}
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      )}

      {/* 기호 툴바 */}
      <SymbolToolbar onInsert={handleInsertSymbol} />

      {/* 에디터 영역: 모바일 세로 배치, 데스크톱 가로 배치 */}
      <div className="flex flex-col gap-3 md:flex-row">
        {/* 좌측: LaTeX 입력 */}
        <div className="flex flex-1 flex-col">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(
              "min-h-[120px] flex-1 resize-y rounded-md border bg-white p-3 font-mono text-sm dark:bg-slate-900 dark:text-slate-100",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:focus:ring-slate-500",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              error
                ? "border-red-400 focus:ring-red-400"
                : "border-slate-200 dark:border-slate-700",
            )}
          />
        </div>

        {/* 우측: 실시간 미리보기 */}
        <PreviewPanel latex={debouncedValue} displayMode={displayMode} />
      </div>

      {/* 폼 유효성 에러 메시지 */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

export { FormulaEditor };
export type { FormulaEditorProps };
