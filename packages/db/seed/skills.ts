// 시드 데이터: 중학교 수학 스킬 트리 (50개)
import type { PrismaClient } from "@prisma/client";

/**
 * 스킬 정의 배열.
 *
 * typeLevel은 문제 유형 분류(1~6):
 *  1=개념이해, 2=기본연산, 3=유형적용, 4=복합적용, 5=심화추론, 6=창의융합
 * bloomLevel(인지 수준)과 독립적이며, 스킬의 문항 수행 유형을 나타낸다.
 */
export const SKILLS = [
  // ── 수와 연산 (10) ──
  { code: "NUM-001", title: "정수의 사칙연산", topicPath: "math.number.integer_ops", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "NUM-002", title: "정수의 혼합연산과 계산 순서", topicPath: "math.number.integer_mixed", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "NUM-003", title: "유리수의 개념과 표현", topicPath: "math.number.rational_concept", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "NUM-004", title: "유리수의 사칙연산", topicPath: "math.number.rational_ops", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "NUM-005", title: "소인수분해", topicPath: "math.number.prime_factorization", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 10 },
  { code: "NUM-006", title: "최대공약수와 최소공배수", topicPath: "math.number.gcd_lcm", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "NUM-007", title: "제곱근의 뜻과 성질", topicPath: "math.number.square_root", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "NUM-008", title: "무리수와 실수", topicPath: "math.number.irrational", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "NUM-009", title: "근호를 포함한 식의 계산", topicPath: "math.number.radical_calc", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "NUM-010", title: "실수의 대소 관계", topicPath: "math.number.real_order", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 8 },

  // ── 문자와 식 (10) ──
  { code: "EXP-001", title: "문자의 사용과 식의 값", topicPath: "math.expression.variable_intro", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "EXP-002", title: "일차식의 계산", topicPath: "math.expression.linear_calc", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "EXP-003", title: "다항식의 덧셈과 뺄셈", topicPath: "math.expression.poly_add_sub", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "EXP-004", title: "지수법칙", topicPath: "math.expression.exponent_law", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EXP-005", title: "단항식의 곱셈과 나눗셈", topicPath: "math.expression.mono_mul_div", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EXP-006", title: "다항식의 곱셈", topicPath: "math.expression.poly_multiply", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "EXP-007", title: "곱셈공식", topicPath: "math.expression.expansion_formula", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EXP-008", title: "인수분해", topicPath: "math.expression.factoring", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "EXP-009", title: "등식의 성질", topicPath: "math.expression.equation_property", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 8 },
  { code: "EXP-010", title: "부등식의 성질", topicPath: "math.expression.inequality_property", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 8 },

  // ── 방정식 (10) ──
  { code: "EQ-001", title: "일차방정식의 풀이", topicPath: "math.equation.linear_solve", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 10 },
  { code: "EQ-002", title: "일차방정식의 활용", topicPath: "math.equation.linear_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "EQ-003", title: "연립일차방정식의 풀이 (가감법)", topicPath: "math.equation.system_elimination", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EQ-004", title: "연립일차방정식의 풀이 (대입법)", topicPath: "math.equation.system_substitution", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EQ-005", title: "연립일차방정식의 활용", topicPath: "math.equation.system_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "EQ-006", title: "이차방정식의 풀이 (인수분해)", topicPath: "math.equation.quadratic_factor", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "EQ-007", title: "이차방정식의 풀이 (근의 공식)", topicPath: "math.equation.quadratic_formula", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "EQ-008", title: "이차방정식의 활용", topicPath: "math.equation.quadratic_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 18 },
  { code: "EQ-009", title: "일차부등식의 풀이", topicPath: "math.equation.linear_ineq_solve", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 10 },
  { code: "EQ-010", title: "연립일차부등식의 풀이", topicPath: "math.equation.system_ineq_solve", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },

  // ── 함수 (10) ──
  { code: "FN-001", title: "좌표평면과 순서쌍", topicPath: "math.function.coordinate_plane", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "FN-002", title: "함수의 뜻과 함숫값", topicPath: "math.function.concept", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "FN-003", title: "일차함수의 뜻과 그래프", topicPath: "math.function.linear_graph", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "FN-004", title: "일차함수의 기울기와 절편", topicPath: "math.function.slope_intercept", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "FN-005", title: "일차함수와 일차방정식의 관계", topicPath: "math.function.linear_eq_relation", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "FN-006", title: "일차함수의 활용", topicPath: "math.function.linear_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "FN-007", title: "이차함수 y=ax²의 그래프", topicPath: "math.function.quadratic_basic", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "FN-008", title: "이차함수 y=a(x-p)²+q의 그래프", topicPath: "math.function.quadratic_vertex", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "FN-009", title: "이차함수 y=ax²+bx+c의 그래프", topicPath: "math.function.quadratic_general", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "FN-010", title: "이차함수의 최댓값과 최솟값", topicPath: "math.function.quadratic_extrema", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },

  // ── 기하 (10) ──
  { code: "GEO-001", title: "점, 선, 면과 각", topicPath: "math.geometry.basic_elements", bloomLevel: 1, typeLevel: 1, estimatedTimeMin: 8 },
  { code: "GEO-002", title: "평행선의 성질", topicPath: "math.geometry.parallel_lines", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 10 },
  { code: "GEO-003", title: "작도와 합동", topicPath: "math.geometry.construction_congruence", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "GEO-004", title: "삼각형의 성질", topicPath: "math.geometry.triangle_props", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "GEO-005", title: "삼각형의 합동 조건", topicPath: "math.geometry.triangle_congruence", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "GEO-006", title: "사각형의 성질", topicPath: "math.geometry.quadrilateral_props", bloomLevel: 2, typeLevel: 2, estimatedTimeMin: 12 },
  { code: "GEO-007", title: "도형의 닮음", topicPath: "math.geometry.similarity", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 15 },
  { code: "GEO-008", title: "닮음의 활용", topicPath: "math.geometry.similarity_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
  { code: "GEO-009", title: "피타고라스 정리", topicPath: "math.geometry.pythagorean", bloomLevel: 3, typeLevel: 3, estimatedTimeMin: 12 },
  { code: "GEO-010", title: "피타고라스 정리의 활용", topicPath: "math.geometry.pythagorean_apply", bloomLevel: 4, typeLevel: 4, estimatedTimeMin: 15 },
] as const;

/** 스킬 50개 시드 (멱등) */
export async function seedSkills(prisma: PrismaClient, orgId: string) {
  const created: Record<string, string> = {};

  for (const s of SKILLS) {
    const skill = await prisma.skill.upsert({
      where: { orgId_code: { orgId, code: s.code } },
      update: {
        title: s.title,
        topicPath: s.topicPath,
        bloomLevel: s.bloomLevel,
        typeLevel: s.typeLevel,
        estimatedTimeMin: s.estimatedTimeMin,
      },
      create: {
        orgId,
        code: s.code,
        title: s.title,
        topicPath: s.topicPath,
        bloomLevel: s.bloomLevel,
        typeLevel: s.typeLevel,
        estimatedTimeMin: s.estimatedTimeMin,
      },
    });
    created[s.code] = skill.id;
  }

  console.log(`  [스킬] ${Object.keys(created).length}개 생성/갱신`);
  return created;
}
