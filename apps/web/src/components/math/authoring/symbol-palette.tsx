"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- 타입 ---

interface SymbolEntry {
  readonly latex: string;  // MathLive 포맷 (#@, #0 포함)
  readonly label: string;
  readonly tooltip: string;
}

interface SymbolCategory {
  readonly name: string;
  readonly icon: string;
  readonly symbols: readonly SymbolEntry[];
}

// --- 카테고리별 수학 기호 (8개 카테고리, 100+ 기호) ---

const SYMBOL_CATEGORIES: readonly SymbolCategory[] = [
  {
    name: "기본 연산",
    icon: "±",
    symbols: [
      { latex: "+", label: "+", tooltip: "더하기" },
      { latex: "-", label: "−", tooltip: "빼기" },
      { latex: "\\times", label: "×", tooltip: "곱하기" },
      { latex: "\\div", label: "÷", tooltip: "나누기" },
      { latex: "\\pm", label: "±", tooltip: "플러스마이너스" },
      { latex: "\\cdot", label: "·", tooltip: "점곱" },
      { latex: "=", label: "=", tooltip: "등호" },
      { latex: "\\neq", label: "≠", tooltip: "같지 않음" },
      { latex: "\\approx", label: "≈", tooltip: "약" },
      { latex: "<", label: "<", tooltip: "미만" },
      { latex: ">", label: ">", tooltip: "초과" },
      { latex: "\\leq", label: "≤", tooltip: "이하" },
      { latex: "\\geq", label: "≥", tooltip: "이상" },
      { latex: "\\ll", label: "≪", tooltip: "매우 작은" },
      { latex: "\\gg", label: "≫", tooltip: "매우 큰" },
    ],
  },
  {
    name: "분수·지수·루트",
    icon: "√",
    symbols: [
      { latex: "\\frac{#@}{#0}", label: "a/b", tooltip: "분수" },
      { latex: "#@^{#0}", label: "xⁿ", tooltip: "거듭제곱" },
      { latex: "#@_{#0}", label: "x_n", tooltip: "아래첨자" },
      { latex: "#@^{2}", label: "x²", tooltip: "제곱" },
      { latex: "#@^{3}", label: "x³", tooltip: "세제곱" },
      { latex: "\\sqrt{#0}", label: "√x", tooltip: "제곱근" },
      { latex: "\\sqrt[#0]{#0}", label: "ⁿ√x", tooltip: "n제곱근" },
      { latex: "#@^{-1}", label: "x⁻¹", tooltip: "역수" },
      { latex: "\\left|#0\\right|", label: "|x|", tooltip: "절대값" },
      { latex: "\\overline{#0}", label: "x̄", tooltip: "평균/켤레" },
    ],
  },
  {
    name: "그리스 문자",
    icon: "α",
    symbols: [
      { latex: "\\alpha", label: "α", tooltip: "알파" },
      { latex: "\\beta", label: "β", tooltip: "베타" },
      { latex: "\\gamma", label: "γ", tooltip: "감마" },
      { latex: "\\delta", label: "δ", tooltip: "델타" },
      { latex: "\\epsilon", label: "ε", tooltip: "엡실론" },
      { latex: "\\theta", label: "θ", tooltip: "세타" },
      { latex: "\\lambda", label: "λ", tooltip: "람다" },
      { latex: "\\mu", label: "μ", tooltip: "뮤" },
      { latex: "\\pi", label: "π", tooltip: "파이" },
      { latex: "\\sigma", label: "σ", tooltip: "시그마" },
      { latex: "\\phi", label: "φ", tooltip: "피" },
      { latex: "\\omega", label: "ω", tooltip: "오메가" },
      { latex: "\\Delta", label: "Δ", tooltip: "대문자 델타" },
      { latex: "\\Sigma", label: "Σ", tooltip: "대문자 시그마" },
      { latex: "\\Omega", label: "Ω", tooltip: "대문자 오메가" },
    ],
  },
  {
    name: "삼각함수",
    icon: "sin",
    symbols: [
      { latex: "\\sin", label: "sin", tooltip: "사인" },
      { latex: "\\cos", label: "cos", tooltip: "코사인" },
      { latex: "\\tan", label: "tan", tooltip: "탄젠트" },
      { latex: "\\sin^{-1}", label: "sin⁻¹", tooltip: "아크사인" },
      { latex: "\\cos^{-1}", label: "cos⁻¹", tooltip: "아크코사인" },
      { latex: "\\tan^{-1}", label: "tan⁻¹", tooltip: "아크탄젠트" },
      { latex: "\\csc", label: "csc", tooltip: "코시컨트" },
      { latex: "\\sec", label: "sec", tooltip: "시컨트" },
      { latex: "\\cot", label: "cot", tooltip: "코탄젠트" },
    ],
  },
  {
    name: "미적분",
    icon: "∫",
    symbols: [
      { latex: "\\int_{}^{}", label: "∫", tooltip: "적분" },
      { latex: "\\int_{}^{}\\,dx", label: "∫dx", tooltip: "정적분" },
      { latex: "\\iint", label: "∬", tooltip: "이중적분" },
      { latex: "\\oint", label: "∮", tooltip: "선적분" },
      { latex: "\\frac{d}{dx}", label: "d/dx", tooltip: "미분" },
      { latex: "\\frac{d^{2}}{dx^{2}}", label: "d²/dx²", tooltip: "이계도함수" },
      { latex: "\\frac{\\partial}{\\partial x}", label: "∂/∂x", tooltip: "편미분" },
      { latex: "\\lim_{x \\to }", label: "lim", tooltip: "극한" },
      { latex: "\\lim_{x \\to \\infty}", label: "lim→∞", tooltip: "무한대 극한" },
      { latex: "\\lim_{x \\to 0}", label: "lim→0", tooltip: "0 극한" },
      { latex: "\\infty", label: "∞", tooltip: "무한대" },
    ],
  },
  {
    name: "시그마·로그",
    icon: "Σ",
    symbols: [
      { latex: "\\sum_{k=1}^{n}", label: "Σ", tooltip: "합" },
      { latex: "\\prod_{k=1}^{n}", label: "∏", tooltip: "곱" },
      { latex: "\\log_{}", label: "log", tooltip: "로그" },
      { latex: "\\ln", label: "ln", tooltip: "자연로그" },
      { latex: "e^{}", label: "eˣ", tooltip: "자연지수" },
      { latex: "\\binom{}{}", label: "nCr", tooltip: "조합" },
      { latex: "n!", label: "n!", tooltip: "팩토리얼" },
      { latex: "_{n}\\mathrm{P}_{r}", label: "nPr", tooltip: "순열" },
    ],
  },
  {
    name: "행렬·괄호",
    icon: "[ ]",
    symbols: [
      { latex: "\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}", label: "2×2", tooltip: "2×2 행렬" },
      { latex: "\\begin{pmatrix}  \\\\  \\\\  \\end{pmatrix}", label: "3×1", tooltip: "열벡터" },
      { latex: "\\begin{vmatrix}  &  \\\\  &  \\end{vmatrix}", label: "|A|", tooltip: "행렬식" },
      { latex: "\\vec{}", label: "→", tooltip: "벡터" },
      { latex: "\\hat{}", label: "x̂", tooltip: "단위벡터" },
      { latex: "\\left(\\right)", label: "( )", tooltip: "소괄호" },
      { latex: "\\left[\\right]", label: "[ ]", tooltip: "대괄호" },
      { latex: "\\left\\{\\right\\}", label: "{ }", tooltip: "중괄호" },
      { latex: "\\cdots", label: "⋯", tooltip: "가로 점" },
      { latex: "\\vdots", label: "⋮", tooltip: "세로 점" },
    ],
  },
  {
    name: "집합·논리",
    icon: "∈",
    symbols: [
      { latex: "\\in", label: "∈", tooltip: "원소" },
      { latex: "\\notin", label: "∉", tooltip: "원소 아님" },
      { latex: "\\subset", label: "⊂", tooltip: "부분집합" },
      { latex: "\\subseteq", label: "⊆", tooltip: "부분집합(등호)" },
      { latex: "\\cup", label: "∪", tooltip: "합집합" },
      { latex: "\\cap", label: "∩", tooltip: "교집합" },
      { latex: "\\emptyset", label: "∅", tooltip: "공집합" },
      { latex: "\\mathbb{R}", label: "ℝ", tooltip: "실수" },
      { latex: "\\mathbb{N}", label: "ℕ", tooltip: "자연수" },
      { latex: "\\mathbb{Z}", label: "ℤ", tooltip: "정수" },
      { latex: "\\forall", label: "∀", tooltip: "모든" },
      { latex: "\\exists", label: "∃", tooltip: "존재" },
      { latex: "\\Rightarrow", label: "⇒", tooltip: "함의" },
      { latex: "\\Leftrightarrow", label: "⇔", tooltip: "동치" },
      { latex: "\\therefore", label: "∴", tooltip: "그러므로" },
    ],
  },
];

// --- MathLive 포맷 → plain LaTeX 변환 ---

/** MathLive 플레이스홀더(#@, #0)를 빈 문자열로 변환 (textarea 삽입용) */
export function toPlainLatex(mathLiveLatex: string): string {
  return mathLiveLatex.replace(/#@/g, "").replace(/#0/g, "");
}

// --- 기호 팔레트 컴포넌트 ---

interface SymbolPaletteProps {
  /** 기호 삽입 콜백 */
  readonly onInsert: (latex: string) => void;
  /** 컴팩트 모드 (카테고리 탭 아이콘만 표시) */
  readonly compact?: boolean;
  /** true면 MathLive 원본 포맷(#@, #0 포함)으로 전달. false면 plain LaTeX로 변환 */
  readonly raw?: boolean;
}

const SymbolPalette = memo(function SymbolPalette({ onInsert, compact = false, raw = false }: SymbolPaletteProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const category = SYMBOL_CATEGORIES[activeCategory];

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* 카테고리 탭 */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        {SYMBOL_CATEGORIES.map((cat, i) => (
          <Tooltip key={cat.name}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveCategory(i)}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1.5 text-xs font-medium transition-colors",
                  i === activeCategory
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300",
                )}
              >
                <span className="mr-0.5">{cat.icon}</span>
                {!compact && <span className="hidden sm:inline"> {cat.name}</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>{cat.name}</p></TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* 기호 그리드 */}
      {category && (
        <div className="flex flex-wrap gap-1 p-2">
          {category.symbols.map((sym, i) => (
            <Tooltip key={`${sym.latex}-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onInsert(raw ? sym.latex : toPlainLatex(sym.latex))}
                  className="flex h-8 min-w-[36px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 text-sm
                    transition-colors hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100
                    dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-blue-950"
                >
                  {sym.label}
                </button>
              </TooltipTrigger>
              <TooltipContent><p>{sym.tooltip}</p></TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
});

export { SymbolPalette, SYMBOL_CATEGORIES };
export type { SymbolEntry, SymbolCategory, SymbolPaletteProps };
