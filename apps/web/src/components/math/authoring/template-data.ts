import type { FormulaTemplate, TemplateCategory } from "./popup-types";

export const TEMPLATE_CATEGORIES: readonly { key: TemplateCategory; label: string }[] = [
  { key: "algebra", label: "대수" },
  { key: "geometry", label: "기하" },
  { key: "trigonometry", label: "삼각함수" },
  { key: "calculus", label: "미적분" },
  { key: "statistics", label: "확률과 통계" },
  { key: "exam_patterns", label: "수능 출제 패턴" },
];

export const FORMULA_TEMPLATES: readonly FormulaTemplate[] = [
  // 대수
  { id: "alg-01", label: "근의 공식", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", category: "algebra", tags: ["이차방정식", "근", "판별식"] },
  { id: "alg-02", label: "판별식", latex: "D = b^2 - 4ac", category: "algebra", tags: ["이차방정식", "판별식"] },
  { id: "alg-03", label: "근과 계수의 관계", latex: "\\alpha + \\beta = -\\frac{b}{a}, \\quad \\alpha\\beta = \\frac{c}{a}", category: "algebra", tags: ["이차방정식", "근과 계수"] },
  { id: "alg-04", label: "등차수열 일반항", latex: "a_n = a_1 + (n-1)d", category: "algebra", tags: ["수열", "등차"] },
  { id: "alg-05", label: "등차수열 합", latex: "S_n = \\frac{n(a_1 + a_n)}{2}", category: "algebra", tags: ["수열", "등차", "합"] },
  { id: "alg-06", label: "등비수열 일반항", latex: "a_n = a_1 \\cdot r^{n-1}", category: "algebra", tags: ["수열", "등비"] },
  { id: "alg-07", label: "등비수열 합", latex: "S_n = a_1 \\cdot \\frac{1 - r^n}{1 - r} \\quad (r \\neq 1)", category: "algebra", tags: ["수열", "등비", "합"] },
  { id: "alg-08", label: "이항정리", latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k", category: "algebra", tags: ["이항정리", "조합"] },
  { id: "alg-09", label: "로그 성질 (곱)", latex: "\\log_a (MN) = \\log_a M + \\log_a N", category: "algebra", tags: ["로그", "성질"] },
  { id: "alg-10", label: "로그 밑 변환", latex: "\\log_a b = \\frac{\\log_c b}{\\log_c a}", category: "algebra", tags: ["로그", "밑 변환"] },
  { id: "alg-11", label: "절대값 부등식", latex: "|x - a| < r \\Leftrightarrow a - r < x < a + r", category: "algebra", tags: ["절대값", "부등식"] },
  { id: "alg-12", label: "항등식 (완전제곱)", latex: "(a \\pm b)^2 = a^2 \\pm 2ab + b^2", category: "algebra", tags: ["항등식", "곱셈공식"] },

  // 기하
  { id: "geo-01", label: "두 점 사이의 거리", latex: "d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}", category: "geometry", tags: ["좌표", "거리"] },
  { id: "geo-02", label: "내분점", latex: "\\left( \\frac{mx_2 + nx_1}{m+n}, \\frac{my_2 + ny_1}{m+n} \\right)", category: "geometry", tags: ["좌표", "내분"] },
  { id: "geo-03", label: "원의 방정식", latex: "(x-a)^2 + (y-b)^2 = r^2", category: "geometry", tags: ["원", "방정식"] },
  { id: "geo-04", label: "점과 직선 사이의 거리", latex: "d = \\frac{|ax_1 + by_1 + c|}{\\sqrt{a^2 + b^2}}", category: "geometry", tags: ["직선", "거리"] },
  { id: "geo-05", label: "직선의 기울기", latex: "m = \\frac{y_2 - y_1}{x_2 - x_1}", category: "geometry", tags: ["직선", "기울기"] },
  { id: "geo-06", label: "타원의 방정식", latex: "\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1", category: "geometry", tags: ["타원", "이차곡선"] },
  { id: "geo-07", label: "쌍곡선의 방정식", latex: "\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1", category: "geometry", tags: ["쌍곡선", "이차곡선"] },
  { id: "geo-08", label: "포물선의 방정식", latex: "y^2 = 4px", category: "geometry", tags: ["포물선", "이차곡선"] },

  // 삼각함수
  { id: "trig-01", label: "사인 덧셈정리", latex: "\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta", category: "trigonometry", tags: ["덧셈정리", "사인"] },
  { id: "trig-02", label: "코사인 덧셈정리", latex: "\\cos(\\alpha \\pm \\beta) = \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta", category: "trigonometry", tags: ["덧셈정리", "코사인"] },
  { id: "trig-03", label: "탄젠트 덧셈정리", latex: "\\tan(\\alpha \\pm \\beta) = \\frac{\\tan\\alpha \\pm \\tan\\beta}{1 \\mp \\tan\\alpha\\tan\\beta}", category: "trigonometry", tags: ["덧셈정리", "탄젠트"] },
  { id: "trig-04", label: "배각 공식 (사인)", latex: "\\sin 2\\alpha = 2\\sin\\alpha\\cos\\alpha", category: "trigonometry", tags: ["배각", "사인"] },
  { id: "trig-05", label: "배각 공식 (코사인)", latex: "\\cos 2\\alpha = \\cos^2\\alpha - \\sin^2\\alpha", category: "trigonometry", tags: ["배각", "코사인"] },
  { id: "trig-06", label: "반각 공식", latex: "\\sin^2 \\frac{\\alpha}{2} = \\frac{1 - \\cos\\alpha}{2}", category: "trigonometry", tags: ["반각"] },
  { id: "trig-07", label: "사인법칙", latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R", category: "trigonometry", tags: ["사인법칙", "삼각형"] },
  { id: "trig-08", label: "코사인법칙", latex: "a^2 = b^2 + c^2 - 2bc\\cos A", category: "trigonometry", tags: ["코사인법칙", "삼각형"] },
  { id: "trig-09", label: "피타고라스 항등식", latex: "\\sin^2\\theta + \\cos^2\\theta = 1", category: "trigonometry", tags: ["항등식", "피타고라스"] },

  // 미적분
  { id: "calc-01", label: "미분 정의", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}", category: "calculus", tags: ["미분", "정의", "극한"] },
  { id: "calc-02", label: "거듭제곱 미분", latex: "\\frac{d}{dx} x^n = nx^{n-1}", category: "calculus", tags: ["미분", "거듭제곱"] },
  { id: "calc-03", label: "곱의 미분법", latex: "(fg)' = f'g + fg'", category: "calculus", tags: ["미분", "곱"] },
  { id: "calc-04", label: "합성함수 미분법", latex: "\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}", category: "calculus", tags: ["미분", "합성함수", "연쇄법칙"] },
  { id: "calc-05", label: "정적분 (기본정리)", latex: "\\int_a^b f(x)\\,dx = F(b) - F(a)", category: "calculus", tags: ["적분", "기본정리"] },
  { id: "calc-06", label: "치환적분", latex: "\\int f(g(x))g'(x)\\,dx = \\int f(u)\\,du", category: "calculus", tags: ["적분", "치환"] },
  { id: "calc-07", label: "부분적분", latex: "\\int u\\,dv = uv - \\int v\\,du", category: "calculus", tags: ["적분", "부분적분"] },
  { id: "calc-08", label: "지수함수 미분", latex: "\\frac{d}{dx} e^x = e^x", category: "calculus", tags: ["미분", "지수"] },
  { id: "calc-09", label: "로그함수 미분", latex: "\\frac{d}{dx} \\ln x = \\frac{1}{x}", category: "calculus", tags: ["미분", "로그"] },
  { id: "calc-10", label: "삼각함수 미분 (sin)", latex: "\\frac{d}{dx} \\sin x = \\cos x", category: "calculus", tags: ["미분", "삼각함수"] },

  // 확률과 통계
  { id: "stat-01", label: "순열", latex: "_nP_r = \\frac{n!}{(n-r)!}", category: "statistics", tags: ["순열", "경우의 수"] },
  { id: "stat-02", label: "조합", latex: "_nC_r = \\binom{n}{r} = \\frac{n!}{r!(n-r)!}", category: "statistics", tags: ["조합", "경우의 수"] },
  { id: "stat-03", label: "확률의 덧셈정리", latex: "P(A \\cup B) = P(A) + P(B) - P(A \\cap B)", category: "statistics", tags: ["확률", "덧셈"] },
  { id: "stat-04", label: "조건부 확률", latex: "P(A|B) = \\frac{P(A \\cap B)}{P(B)}", category: "statistics", tags: ["조건부 확률"] },
  { id: "stat-05", label: "기댓값", latex: "E(X) = \\sum_{i=1}^{n} x_i P(X = x_i)", category: "statistics", tags: ["기댓값", "평균"] },
  { id: "stat-06", label: "분산", latex: "V(X) = E(X^2) - [E(X)]^2", category: "statistics", tags: ["분산", "표준편차"] },
  { id: "stat-07", label: "이항분포", latex: "P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}", category: "statistics", tags: ["이항분포", "확률분포"] },
  { id: "stat-08", label: "정규분포 표준화", latex: "Z = \\frac{X - \\mu}{\\sigma}", category: "statistics", tags: ["정규분포", "표준화"] },

  // 수능 출제 패턴
  { id: "exam-01", label: "함수의 극값 조건", latex: "f'(a) = 0 \\text{ 이고 } f''(a) \\neq 0", category: "exam_patterns", tags: ["극값", "이계도함수"] },
  { id: "exam-02", label: "접선의 방정식", latex: "y - f(a) = f'(a)(x - a)", category: "exam_patterns", tags: ["접선", "미분"] },
  { id: "exam-03", label: "넓이 (정적분)", latex: "S = \\int_a^b |f(x) - g(x)|\\,dx", category: "exam_patterns", tags: ["넓이", "적분"] },
  { id: "exam-04", label: "속도와 거리", latex: "s = \\int_a^b |v(t)|\\,dt", category: "exam_patterns", tags: ["속도", "거리", "적분"] },
  { id: "exam-05", label: "급수의 합", latex: "\\sum_{n=1}^{\\infty} ar^{n-1} = \\frac{a}{1-r} \\quad (|r| < 1)", category: "exam_patterns", tags: ["급수", "등비급수", "수렴"] },
  { id: "exam-06", label: "점화식 (등차)", latex: "a_{n+1} - a_n = d \\quad (\\text{상수})", category: "exam_patterns", tags: ["점화식", "수열"] },
  { id: "exam-07", label: "부등식의 영역", latex: "\\begin{cases} f(x, y) \\geq 0 \\\\ g(x, y) \\leq 0 \\end{cases}", category: "exam_patterns", tags: ["부등식", "영역", "연립"] },
];
