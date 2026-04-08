// 전략 오버라이드 검증 서비스
// SymPy 전략 강제 시 템플릿 구조 적합성 경고 반환

import type { TemplateSnapshot } from "./anthropic-generation.service";

/**
 * 전략 오버라이드가 템플릿 구조와 호환되는지 검증한다.
 * 차단하지 않고 경고만 반환한다 (warn but allow).
 */
export function validateStrategyOverride(
  strategy: "sympy" | "llm",
  template: TemplateSnapshot,
): readonly string[] {
  // LLM은 모든 템플릿에서 작동하므로 경고 없음
  if (strategy !== "sympy") return [];

  const warnings: string[] = [];

  // 1. 파라미터 배열 검증
  if (!Array.isArray(template.parameters) || template.parameters.length === 0) {
    warnings.push(
      "매개변수가 정의되지 않았습니다. SymPy 전략에는 숫자 매개변수가 필요합니다.",
    );
  } else {
    const params = template.parameters as Record<string, unknown>[];
    const allNumeric = params.every(
      (p) =>
        typeof p.name === "string" &&
        typeof p.min === "number" &&
        typeof p.max === "number",
    );
    if (!allNumeric) {
      warnings.push(
        "일부 매개변수에 min/max 범위가 없습니다. SymPy는 숫자 범위가 필요합니다.",
      );
    }
  }

  // 2. bodyTemplate 플레이스홀더 검증
  const hasPlaceholders = /\{\{(\w+)\}\}/.test(template.bodyTemplate);
  if (!hasPlaceholders) {
    warnings.push(
      "본문에 {{변수}} 플레이스홀더가 없습니다. SymPy는 치환 대상이 필요합니다.",
    );
  }

  // 3. answerTemplate 검증
  if (
    typeof template.answerTemplate !== "string" ||
    template.answerTemplate.trim().length === 0
  ) {
    warnings.push(
      "정답 수식이 비어있습니다. SymPy는 정답 템플릿이 필요합니다.",
    );
  }

  return warnings;
}
