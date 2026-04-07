// 시드 데이터: 연구 기반 수학 오개념 (20개)
import type { PrismaClient } from "@prisma/client";

interface MisconceptionDef {
  readonly code: string;
  readonly title: string;
  readonly typicalError: string;
  readonly remediation: string;
  readonly severity: number;
  readonly relatedSkills: readonly string[];
}

/** 연구 기반 중학교 수학 오개념 */
export const MISCONCEPTIONS: readonly MisconceptionDef[] = [
  {
    code: "sign_error_transposition",
    title: "이항 시 부호 오류",
    typicalError: "등식에서 항을 이항할 때 부호를 바꾸지 않음 (예: x+3=5 → x=5+3)",
    remediation: "등식의 양변에 같은 수를 더하거나 빼는 원리부터 재학습",
    severity: 5,
    relatedSkills: ["EQ-001", "EXP-009"],
  },
  {
    code: "distributive_law_omission",
    title: "분배법칙 누락",
    typicalError: "괄호 앞 계수를 괄호 안 일부 항에만 곱함 (예: 2(x+3)=2x+3)",
    remediation: "분배법칙 시각화(넓이 모델)로 개념 재정립",
    severity: 5,
    relatedSkills: ["EXP-002", "EXP-006"],
  },
  {
    code: "fraction_addition_numerator_only",
    title: "분수 덧셈 시 분자만 더함",
    typicalError: "분모가 다른 분수 덧셈에서 통분 없이 분자끼리 더함 (예: 1/2+1/3=2/5)",
    remediation: "통분의 의미를 분수 막대 모델로 시각화하여 재학습",
    severity: 4,
    relatedSkills: ["NUM-004"],
  },
  {
    code: "equation_both_sides",
    title: "등식의 양변 처리 오류",
    typicalError: "등식의 한 변에만 연산을 수행하고 다른 변에는 적용하지 않음",
    remediation: "천칭(저울) 모델을 활용하여 등식의 성질을 체감적으로 이해",
    severity: 4,
    relatedSkills: ["EXP-009", "EQ-001"],
  },
  {
    code: "negative_multiplication",
    title: "음수 곱셈 부호 오류",
    typicalError: "음수 × 음수를 음수로 계산 (예: (-2)×(-3)=-6)",
    remediation: "수직선 모델과 패턴 탐구를 통해 음수 곱셈 규칙 유도",
    severity: 4,
    relatedSkills: ["NUM-001"],
  },
  {
    code: "variable_as_label",
    title: "변수를 라벨로 오해",
    typicalError: "x를 미지수가 아닌 단위 라벨로 이해 (예: 3a+2b에서 a=사과, b=바나나)",
    remediation: "변수의 수학적 의미를 구체적 수치 대입으로 확인",
    severity: 3,
    relatedSkills: ["EXP-001"],
  },
  {
    code: "exponent_addition",
    title: "지수 연산 혼동 (밑이 같은 곱셈)",
    typicalError: "같은 밑의 거듭제곱 곱셈에서 지수를 곱함 (예: x²·x³=x⁶)",
    remediation: "전개식을 써서 곱셈이 지수의 덧셈이 되는 이유를 확인",
    severity: 3,
    relatedSkills: ["EXP-004"],
  },
  {
    code: "square_root_of_sum",
    title: "루트 안의 합을 분리",
    typicalError: "√(a+b)=√a+√b로 계산",
    remediation: "구체적 수치(a=9, b=16)로 반례를 확인하고 올바른 성질 정리",
    severity: 4,
    relatedSkills: ["NUM-007", "NUM-009"],
  },
  {
    code: "cancel_across_addition",
    title: "분수에서 덧셈 항 약분",
    typicalError: "(a+b)/a에서 a를 약분하여 b로 만듦",
    remediation: "약분은 공통인수(곱셈)에만 적용됨을 예시로 확인",
    severity: 4,
    relatedSkills: ["NUM-004", "EXP-005"],
  },
  {
    code: "negative_exponent_sign",
    title: "음수의 거듭제곱 부호 오류",
    typicalError: "-3²을 (-3)²와 혼동하여 9로 계산",
    remediation: "괄호 유무에 따른 차이를 단계적으로 비교",
    severity: 3,
    relatedSkills: ["NUM-001", "EXP-004"],
  },
  {
    code: "inequality_multiply_negative",
    title: "부등식에 음수 곱할 때 부등호 방향 유지",
    typicalError: "-2x>6에서 x>-3으로 계산 (부등호 방향 미변환)",
    remediation: "수직선 위에서 음수 곱셈 시 방향이 바뀌는 과정을 시각화",
    severity: 5,
    relatedSkills: ["EXP-010", "EQ-009"],
  },
  {
    code: "system_eq_variable_mix",
    title: "연립방정식 풀이에서 변수 혼동",
    typicalError: "가감법 적용 시 다른 변수의 계수를 맞추지 않고 더하거나 뺌",
    remediation: "각 단계에서 소거할 변수를 명시적으로 표기하는 습관 형성",
    severity: 3,
    relatedSkills: ["EQ-003", "EQ-004"],
  },
  {
    code: "quadratic_incomplete_solution",
    title: "이차방정식의 해를 하나만 구함",
    typicalError: "x²=9에서 x=3만 답으로 제시",
    remediation: "제곱근의 양수/음수 두 값을 항상 고려하도록 체크리스트 활용",
    severity: 3,
    relatedSkills: ["EQ-006", "EQ-007"],
  },
  {
    code: "slope_fraction_inversion",
    title: "기울기 분수를 뒤집음",
    typicalError: "기울기를 (x변화량)/(y변화량)으로 계산",
    remediation: "기울기 = Δy/Δx 공식을 좌표평면 위 구체적 점으로 반복 확인",
    severity: 3,
    relatedSkills: ["FN-004"],
  },
  {
    code: "linear_function_constant_confusion",
    title: "일차함수 상수항 혼동",
    typicalError: "y=2x+3에서 y절편을 (3,0)으로 오인",
    remediation: "y절편은 x=0일 때의 y값임을 그래프 위에서 확인",
    severity: 2,
    relatedSkills: ["FN-003", "FN-004"],
  },
  {
    code: "congruence_vs_similarity",
    title: "합동과 닮음 혼동",
    typicalError: "모양이 같으면 항상 합동이라고 판단",
    remediation: "합동(크기+모양 같음)과 닮음(모양만 같음)의 차이를 도형 비교로 명확화",
    severity: 2,
    relatedSkills: ["GEO-005", "GEO-007"],
  },
  {
    code: "pythagorean_any_triangle",
    title: "피타고라스 정리를 모든 삼각형에 적용",
    typicalError: "직각삼각형이 아닌 삼각형에도 a²+b²=c² 적용",
    remediation: "피타고라스 정리의 전제 조건(직각삼각형)을 명확히 하고 반례 제시",
    severity: 3,
    relatedSkills: ["GEO-009"],
  },
  {
    code: "factoring_sign_error",
    title: "인수분해 시 부호 오류",
    typicalError: "x²-5x+6을 (x-2)(x+3)으로 인수분해",
    remediation: "전개 검산을 통해 부호를 확인하는 습관 형성",
    severity: 4,
    relatedSkills: ["EXP-008"],
  },
  {
    code: "coordinate_axis_swap",
    title: "좌표축 혼동 (x, y 뒤바꿈)",
    typicalError: "점 (3, 5)를 x축으로 5, y축으로 3만큼 이동한 점으로 표시",
    remediation: "순서쌍(x, y)에서 x가 가로, y가 세로임을 반복 연습",
    severity: 2,
    relatedSkills: ["FN-001"],
  },
  {
    code: "quadratic_vertex_sign",
    title: "이차함수 꼭짓점 좌표 부호 오류",
    typicalError: "y=(x-2)²+3에서 꼭짓점을 (-2, 3)으로 읽음",
    remediation: "y=a(x-p)²+q에서 p앞의 부호 반대가 x좌표임을 형식적으로 연습",
    severity: 3,
    relatedSkills: ["FN-008"],
  },
];

/** 오개념 20개 시드 (멱등) */
export async function seedMisconceptions(prisma: PrismaClient, orgId: string) {
  const created: Record<string, string> = {};

  for (const m of MISCONCEPTIONS) {
    const misconception = await prisma.misconception.upsert({
      where: { orgId_code: { orgId, code: m.code } },
      update: {
        title: m.title,
        typicalError: m.typicalError,
        remediation: m.remediation,
        severity: m.severity,
        relatedSkills: [...m.relatedSkills],
      },
      create: {
        orgId,
        code: m.code,
        title: m.title,
        typicalError: m.typicalError,
        remediation: m.remediation,
        severity: m.severity,
        relatedSkills: [...m.relatedSkills],
      },
    });
    created[m.code] = misconception.id;
  }

  console.log(`  [오개념] ${Object.keys(created).length}개 생성/갱신`);
  return created;
}
