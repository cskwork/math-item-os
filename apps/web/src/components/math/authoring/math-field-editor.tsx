"use client";

import { useEffect, useRef, useCallback, memo, useState } from "react";
import { cn } from "@/lib/utils";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { SymbolPalette } from "./symbol-palette";
import { KOREAN_MATH_LAYOUTS } from "./keyboard-layouts";

// --- 타입 ---

interface MathFieldEditorProps {
  readonly value: string;
  readonly onChange: (latex: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly readOnly?: boolean;
  readonly displayMode?: boolean;
  /** 기호 팔레트 표시 여부 (기본: true) */
  readonly showPalette?: boolean;
}

// --- MathLive 동적 로드 ---

let mathLiveLoaded = false;
let mathLiveLoading: Promise<void> | null = null;

function ensureMathLive(): Promise<void> {
  if (mathLiveLoaded) return Promise.resolve();
  if (mathLiveLoading) return mathLiveLoading;

  mathLiveLoading = import("mathlive").then(() => {
    mathLiveLoaded = true;
    if (typeof window !== "undefined" && (window as any).mathVirtualKeyboard) {
      (window as any).mathVirtualKeyboard.layouts = KOREAN_MATH_LAYOUTS;
    }
  });

  return mathLiveLoading;
}

// --- 메인 컴포넌트 ---

const MathFieldEditor = memo(function MathFieldEditor({
  value,
  onChange,
  placeholder = "수식을 입력하세요...",
  className,
  readOnly = false,
  displayMode = false,
  showPalette = true,
}: MathFieldEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mathFieldRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(mathLiveLoaded);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // MathLive 동적 로드
  useEffect(() => {
    ensureMathLive().then(() => setLoaded(true));
  }, []);

  // math-field 엘리먼트를 DOM에 직접 생성
  useEffect(() => {
    if (!loaded || !containerRef.current || readOnly) return;
    if (mathFieldRef.current) return;

    const mf = document.createElement("math-field") as any;
    mf.setAttribute("virtual-keyboard-mode", "onfocus");
    mf.setAttribute("smart-mode", "true");
    mf.style.width = "100%";
    mf.style.minHeight = displayMode ? "64px" : "40px";
    mf.style.fontSize = displayMode ? "1.25rem" : "1rem";
    mf.style.padding = "8px 12px";
    mf.style.borderRadius = "6px";
    mf.style.border = "1px solid #e2e8f0";
    mf.style.background = "white";

    if (value) {
      mf.setValue(value, { silenceNotifications: true });
    }

    mf.addEventListener("input", () => {
      onChangeRef.current(mf.value);
    });

    containerRef.current.appendChild(mf);
    mathFieldRef.current = mf;

    return () => {
      if (mf.parentNode) mf.parentNode.removeChild(mf);
      mathFieldRef.current = null;
    };
  }, [loaded, readOnly, displayMode]);

  // 외부 value 변경 → math-field 동기화
  useEffect(() => {
    const mf = mathFieldRef.current;
    if (!mf?.setValue) return;
    if (mf.value === value) return;
    mf.setValue(value, { silenceNotifications: true });
  }, [value]);

  // 기호 삽입 핸들러 (MathLive executeCommand)
  const handleSymbolInsert = useCallback((latex: string) => {
    const mf = mathFieldRef.current;
    if (mf?.executeCommand) {
      mf.executeCommand(["insert", latex]);
      onChangeRef.current(mf.value);
      mf.focus();
    }
  }, []);

  // 읽기 전용
  if (readOnly) {
    return (
      <div className={cn("min-h-[40px] rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800", className)}>
        {value ? (
          <KatexRenderer latex={value} displayMode={displayMode} />
        ) : (
          <span className="text-sm text-slate-400">{placeholder}</span>
        )}
      </div>
    );
  }

  // 로딩 중
  if (!loaded) {
    return (
      <div className={cn("flex h-[52px] items-center rounded-md border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900", className)}>
        <span className="text-sm text-slate-400">수식 편집기 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showPalette && <SymbolPalette onInsert={handleSymbolInsert} raw />}
      <div
        ref={containerRef}
        className="[&_math-field]:focus-within:ring-2 [&_math-field]:focus-within:ring-slate-400 [&_math-field]:focus-within:ring-offset-1"
      />
      {!value && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          위 기호를 클릭하거나, 편집 필드에서 직접 수식을 입력하세요.
        </p>
      )}
    </div>
  );
});

export { MathFieldEditor };
export type { MathFieldEditorProps };
