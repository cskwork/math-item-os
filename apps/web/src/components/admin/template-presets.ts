// 중학교 수학 템플릿 프리셋 데이터
// TemplateEditor 프리셋 드롭다운 + DB 시딩에서 공유

export interface PresetParameter {
  readonly name: string;
  readonly type: "integer" | "float";
  readonly min: number;
  readonly max: number;
  readonly constraints: readonly string[];
}

export interface TemplatePreset {
  readonly id: string;
  readonly label: string;
  readonly category: "algebra" | "geometry" | "probability";
  readonly title: string;
  readonly bodyTemplate: string;
  readonly parameters: readonly PresetParameter[];
  readonly answerTemplate: string;
  readonly constraints: Record<string, boolean>;
}

/**
 * 중학교 수학 기본 프리셋 (SymPy 4개 + LLM 2개).
 * SymPy 호환: 숫자 파라미터 + {{placeholder}} + answerTemplate
 * LLM 전용: 파라미터 없음 또는 비정형
 */
export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  // ── SymPy 호환 ──
  {
    id: "linear-eq",
    label: "일차방정식 기본형",
    category: "algebra",
    title: "일차방정식 기본형",
    bodyTemplate: "{{a}}x + {{b}} = {{c}}",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 9, constraints: ["nonzero"] },
      { name: "b", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "c", type: "integer", min: -20, max: 20, constraints: [] },
    ],
    answerTemplate: "({{c}} - {{b}}) / {{a}}",
    constraints: { integer_solution: true, no_zero_denominator: true },
  },
  {
    id: "quadratic-eq",
    label: "이차방정식 (인수분해형)",
    category: "algebra",
    title: "이차방정식 (인수분해형)",
    bodyTemplate: "x^2 + {{b}}x + {{c}} = 0",
    parameters: [
      { name: "b", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "c", type: "integer", min: -20, max: 20, constraints: [] },
    ],
    answerTemplate: "(-{{b}} + sqrt({{b}}^2 - 4*{{c}})) / 2",
    constraints: { integer_solution: true },
  },
  {
    id: "linear-ineq",
    label: "일차부등식",
    category: "algebra",
    title: "일차부등식",
    bodyTemplate: "{{a}}x - {{b}} < {{c}}",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 8, constraints: ["positive"] },
      { name: "b", type: "integer", min: 1, max: 15, constraints: ["positive"] },
      { name: "c", type: "integer", min: 1, max: 20, constraints: ["positive"] },
    ],
    answerTemplate: "x < ({{c}} + {{b}}) / {{a}}",
    constraints: { no_zero_denominator: true },
  },
  {
    id: "simultaneous-eq",
    label: "연립방정식 (2원1차)",
    category: "algebra",
    title: "연립방정식 (2원1차)",
    bodyTemplate:
      "\\begin{cases} {{a1}}x + {{b1}}y = {{c1}} \\\\ {{a2}}x + {{b2}}y = {{c2}} \\end{cases}",
    parameters: [
      { name: "a1", type: "integer", min: 1, max: 5, constraints: ["nonzero"] },
      { name: "b1", type: "integer", min: -5, max: 5, constraints: ["nonzero"] },
      { name: "c1", type: "integer", min: -10, max: 10, constraints: [] },
      { name: "a2", type: "integer", min: 1, max: 5, constraints: ["nonzero"] },
      { name: "b2", type: "integer", min: -5, max: 5, constraints: ["nonzero"] },
      { name: "c2", type: "integer", min: -10, max: 10, constraints: [] },
    ],
    answerTemplate:
      "({{c1}}*{{b2}} - {{c2}}*{{b1}}) / ({{a1}}*{{b2}} - {{a2}}*{{b1}})",
    constraints: { integer_solution: true, no_zero_denominator: true },
  },

  // ── LLM 전용 ──
  {
    id: "pythagorean-proof",
    label: "피타고라스 정리 응용",
    category: "geometry",
    title: "피타고라스 정리 응용",
    bodyTemplate:
      "직각삼각형의 두 변의 길이가 주어졌을 때, 나머지 한 변의 길이를 구하시오.",
    parameters: [],
    answerTemplate: "",
    constraints: {},
  },
  {
    id: "probability-basic",
    label: "확률 기본 (경우의 수)",
    category: "probability",
    title: "확률 기본 (경우의 수)",
    bodyTemplate:
      "주머니에 빨간 구슬과 파란 구슬이 들어있다. 무작위로 하나를 꺼낼 때 특정 색 구슬이 나올 확률을 구하시오.",
    parameters: [],
    answerTemplate: "",
    constraints: {},
  },
] as const;

/** 카테고리 레이블 */
export const CATEGORY_LABELS: Record<TemplatePreset["category"], string> = {
  algebra: "대수",
  geometry: "기하",
  probability: "확률/통계",
};
