// strategy-validation.service 단위 테스트
// 각 경고 조건을 독립적으로 검증
import { describe, it, expect } from "vitest";
import { validateStrategyOverride } from "../strategy-validation.service";
import type { TemplateSnapshot } from "../anthropic-generation.service";

// 헬퍼: SymPy 완전 호환 템플릿
function makeSymPyTemplate(
  overrides?: Partial<TemplateSnapshot>,
): TemplateSnapshot {
  return {
    id: "t1",
    orgId: "org",
    title: "일차방정식",
    bodyTemplate: "{{a}}x + {{b}} = {{c}}",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 10 },
      { name: "b", type: "integer", min: -10, max: 10 },
      { name: "c", type: "integer", min: -20, max: 20 },
    ],
    answerTemplate: "x = ({{c}} - {{b}}) / {{a}}",
    constraints: {},
    ...overrides,
  };
}

describe("validateStrategyOverride", () => {
  it("LLM 오버라이드는 항상 경고 없음", () => {
    const template = makeSymPyTemplate({ parameters: [] });
    const warnings = validateStrategyOverride("llm", template);
    expect(warnings).toEqual([]);
  });

  it("SymPy 호환 템플릿에 sympy 오버라이드 -> 경고 없음", () => {
    const template = makeSymPyTemplate();
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings).toEqual([]);
  });

  it("파라미터 없는 템플릿에 sympy 오버라이드 -> 경고", () => {
    const template = makeSymPyTemplate({ parameters: [] });
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings).toContainEqual(
      expect.stringContaining("매개변수가 정의되지 않았습니다"),
    );
  });

  it("min/max 없는 파라미터에 sympy 오버라이드 -> 경고", () => {
    const template = makeSymPyTemplate({
      parameters: [{ name: "topic", type: "string" }],
    });
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings).toContainEqual(
      expect.stringContaining("min/max 범위가 없습니다"),
    );
  });

  it("플레이스홀더 없는 bodyTemplate에 sympy 오버라이드 -> 경고", () => {
    const template = makeSymPyTemplate({
      bodyTemplate: "2x + 3 = 7을 풀어라",
    });
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings).toContainEqual(
      expect.stringContaining("플레이스홀더가 없습니다"),
    );
  });

  it("answerTemplate 비어있을 때 sympy 오버라이드 -> 경고", () => {
    const template = makeSymPyTemplate({ answerTemplate: "" });
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings).toContainEqual(
      expect.stringContaining("정답 수식이 비어있습니다"),
    );
  });

  it("여러 조건 미충족 시 복수 경고 반환", () => {
    const template = makeSymPyTemplate({
      parameters: [],
      bodyTemplate: "문제를 풀어라",
      answerTemplate: "",
    });
    const warnings = validateStrategyOverride("sympy", template);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});
