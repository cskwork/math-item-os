// MathLive 가상 키보드 — 한국어 레이블 커스텀 레이아웃

export const KOREAN_MATH_LAYOUTS = [
  {
    label: "기본",
    tooltip: "기본 수학 기호",
    rows: [
      [
        { latex: "\\frac{#@}{#0}", label: "분수", class: "small" as const },
        { latex: "\\sqrt{#0}", label: "루트", class: "small" as const },
        { latex: "#@^{#0}", label: "지수", class: "small" as const },
        { latex: "#@_{#0}", label: "첨자", class: "small" as const },
        "+", "-", "\\times", "\\div", "=",
      ],
      [
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
      ],
      [
        "(", ")", "\\leq", "\\geq", "\\neq",
        { latex: "\\pm", label: "±" },
        { latex: "\\left|#0\\right|", label: "|x|", class: "small" as const },
        "[backspace]",
      ],
    ],
  },
  {
    label: "고급",
    tooltip: "고급 수학 기호",
    rows: [
      [
        { latex: "\\sum_{#0}^{#0}", label: "합", class: "small" as const },
        { latex: "\\int_{#0}^{#0}", label: "적분", class: "small" as const },
        { latex: "\\lim_{#0}", label: "극한", class: "small" as const },
        { latex: "\\log_{#0}", label: "로그", class: "small" as const },
        "\\infty",
        { latex: "\\binom{#0}{#0}", label: "조합", class: "small" as const },
      ],
      [
        "\\sin", "\\cos", "\\tan",
        { latex: "\\sin^{-1}", label: "arcsin", class: "small" as const },
        { latex: "\\cos^{-1}", label: "arccos", class: "small" as const },
        { latex: "\\tan^{-1}", label: "arctan", class: "small" as const },
      ],
      [
        { latex: "\\vec{#0}", label: "벡터", class: "small" as const },
        { latex: "\\overline{#0}", label: "평균", class: "small" as const },
        { latex: "\\begin{pmatrix} #0 & #0 \\\\ #0 & #0 \\end{pmatrix}", label: "행렬", class: "small" as const },
        "\\cdots", "\\vdots", "\\ddots",
        "[backspace]",
      ],
    ],
  },
  "greek",
] as const;
