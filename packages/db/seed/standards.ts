// 시드 데이터: 2022 개정 교육과정 중학교 수학 성취기준 (30개)
import type { PrismaClient } from "@prisma/client";
import type { SchoolLevel } from "@prisma/client";

interface StandardDef {
  readonly code: string;
  readonly title: string;
  readonly grade: number;
  readonly topicPath: string;
}

/** 2022 개정 교육과정 성취기준 */
export const STANDARDS: readonly StandardDef[] = [
  // ── 중1 수와 연산 (4) ──
  { code: "KR2022-M1-NUM-01", title: "소인수분해를 하고 최대공약수와 최소공배수를 구할 수 있다", grade: 1, topicPath: "math.number.prime_factorization" },
  { code: "KR2022-M1-NUM-02", title: "정수와 유리수의 개념을 이해하고 대소 관계를 판단할 수 있다", grade: 1, topicPath: "math.number.integer_ops" },
  { code: "KR2022-M1-NUM-03", title: "정수와 유리수의 사칙연산과 혼합 계산을 할 수 있다", grade: 1, topicPath: "math.number.rational_ops" },

  // ── 중1 문자와 식 (3) ──
  { code: "KR2022-M1-EXP-01", title: "문자를 사용한 식을 간단히 나타내고 식의 값을 구할 수 있다", grade: 1, topicPath: "math.expression.variable_intro" },
  { code: "KR2022-M1-EXP-02", title: "일차식의 덧셈과 뺄셈을 할 수 있다", grade: 1, topicPath: "math.expression.linear_calc" },
  { code: "KR2022-M1-EXP-03", title: "등식의 성질을 이해하고 일차방정식을 풀 수 있다", grade: 1, topicPath: "math.expression.equation_property" },

  // ── 중1 방정식 (3) ──
  { code: "KR2022-M1-EQ-01", title: "일차방정식을 풀 수 있다", grade: 1, topicPath: "math.equation.linear_solve" },
  { code: "KR2022-M1-EQ-02", title: "일차방정식을 활용하여 문제를 해결할 수 있다", grade: 1, topicPath: "math.equation.linear_apply" },
  { code: "KR2022-M1-EQ-03", title: "일차부등식을 풀 수 있다", grade: 1, topicPath: "math.equation.linear_ineq_solve" },

  // ── 중1 함수 (2) ──
  { code: "KR2022-M1-FN-01", title: "좌표평면 위의 점의 좌표를 구할 수 있다", grade: 1, topicPath: "math.function.coordinate_plane" },
  { code: "KR2022-M1-FN-02", title: "정비례와 반비례 관계를 이해하고 그래프를 그릴 수 있다", grade: 1, topicPath: "math.function.concept" },

  // ── 중1 기하 (3) ──
  { code: "KR2022-M1-GEO-01", title: "기본 도형의 성질을 이해할 수 있다", grade: 1, topicPath: "math.geometry.basic_elements" },
  { code: "KR2022-M1-GEO-02", title: "평행선에서 동위각과 엇각의 성질을 이해할 수 있다", grade: 1, topicPath: "math.geometry.parallel_lines" },
  { code: "KR2022-M1-GEO-03", title: "작도를 하고 삼각형의 합동 조건을 이해할 수 있다", grade: 1, topicPath: "math.geometry.construction_congruence" },

  // ── 중2 수와 연산 (2) ──
  { code: "KR2022-M2-NUM-01", title: "유리수와 순환소수의 관계를 이해할 수 있다", grade: 2, topicPath: "math.number.rational_concept" },
  { code: "KR2022-M2-NUM-02", title: "지수법칙을 이해하고 활용할 수 있다", grade: 2, topicPath: "math.expression.exponent_law" },

  // ── 중2 문자와 식 (3) ──
  { code: "KR2022-M2-EXP-01", title: "다항식의 덧셈과 뺄셈을 할 수 있다", grade: 2, topicPath: "math.expression.poly_add_sub" },
  { code: "KR2022-M2-EXP-02", title: "단항식의 곱셈과 나눗셈을 할 수 있다", grade: 2, topicPath: "math.expression.mono_mul_div" },
  { code: "KR2022-M2-EXP-03", title: "다항식의 곱셈을 할 수 있다", grade: 2, topicPath: "math.expression.poly_multiply" },

  // ── 중2 방정식 (2) ──
  { code: "KR2022-M2-EQ-01", title: "연립일차방정식을 풀 수 있다", grade: 2, topicPath: "math.equation.system_elimination" },
  { code: "KR2022-M2-EQ-02", title: "연립일차방정식을 활용하여 문제를 해결할 수 있다", grade: 2, topicPath: "math.equation.system_apply" },

  // ── 중2 함수 (3) ──
  { code: "KR2022-M2-FN-01", title: "일차함수의 의미를 이해하고 그래프를 그릴 수 있다", grade: 2, topicPath: "math.function.linear_graph" },
  { code: "KR2022-M2-FN-02", title: "일차함수의 기울기와 절편의 의미를 이해할 수 있다", grade: 2, topicPath: "math.function.slope_intercept" },
  { code: "KR2022-M2-FN-03", title: "일차함수와 일차방정식의 관계를 이해할 수 있다", grade: 2, topicPath: "math.function.linear_eq_relation" },

  // ── 중2 기하 (2) ──
  { code: "KR2022-M2-GEO-01", title: "삼각형의 성질을 이해하고 활용할 수 있다", grade: 2, topicPath: "math.geometry.triangle_props" },
  { code: "KR2022-M2-GEO-02", title: "사각형의 성질을 이해하고 활용할 수 있다", grade: 2, topicPath: "math.geometry.quadrilateral_props" },

  // ── 중3 수와 연산 (2) ──
  { code: "KR2022-M3-NUM-01", title: "제곱근의 뜻을 알고 성질을 이해할 수 있다", grade: 3, topicPath: "math.number.square_root" },
  { code: "KR2022-M3-NUM-02", title: "무리수의 개념을 이해하고 실수의 대소 관계를 판단할 수 있다", grade: 3, topicPath: "math.number.irrational" },

  // ── 중3 방정식 (2) ──
  { code: "KR2022-M3-EQ-01", title: "이차방정식을 풀 수 있다", grade: 3, topicPath: "math.equation.quadratic_factor" },
  { code: "KR2022-M3-EQ-02", title: "이차방정식을 활용하여 문제를 해결할 수 있다", grade: 3, topicPath: "math.equation.quadratic_apply" },
] as const;

/** 성취기준 30개 시드 (멱등) */
export async function seedStandards(prisma: PrismaClient, orgId: string) {
  const created: Record<string, string> = {};
  const schoolLevel: SchoolLevel = "middle";

  for (const s of STANDARDS) {
    const standard = await prisma.standard.upsert({
      where: { orgId_code: { orgId, code: s.code } },
      update: {
        title: s.title,
        schoolLevel,
        grade: s.grade,
        topicPath: s.topicPath,
      },
      create: {
        orgId,
        code: s.code,
        title: s.title,
        schoolLevel,
        grade: s.grade,
        topicPath: s.topicPath,
      },
    });
    created[s.code] = standard.id;
  }

  console.log(`  [성취기준] ${Object.keys(created).length}개 생성/갱신`);
  return created;
}
