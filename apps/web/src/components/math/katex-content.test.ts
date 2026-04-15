import { describe, it, expect } from "vitest";
import {
  hasDelimitedMath,
  shouldTreatAsPlainText,
  tokenizeKatexContent,
} from "./katex-content";

describe("tokenizeKatexContent", () => {
  it("혼합 텍스트와 인라인 수식을 분리한다", () => {
    expect(
      tokenizeKatexContent("$(-3) + 7$의 값을 구하시오."),
    ).toEqual([
      { type: "math", content: "(-3) + 7", displayMode: false },
      { type: "text", content: "의 값을 구하시오." },
    ]);
  });

  it("순수 텍스트는 text 세그먼트로 반환한다", () => {
    expect(tokenizeKatexContent("60을 소인수분해하시오.")).toEqual([
      { type: "text", content: "60을 소인수분해하시오." },
    ]);
  });
});

describe("hasDelimitedMath", () => {
  it("구분자가 있는 수식을 감지한다", () => {
    expect(hasDelimitedMath("\\begin{cases} x+y=1 \\end{cases}")).toBe(false);
    expect(hasDelimitedMath("$x+1$을 계산하시오.")).toBe(true);
    expect(hasDelimitedMath("\\(x+1\\)")).toBe(true);
  });
});

describe("shouldTreatAsPlainText", () => {
  it("한국어 텍스트와 순수 LaTeX를 구분한다", () => {
    expect(shouldTreatAsPlainText("60을 소인수분해하시오.")).toBe(true);
    expect(shouldTreatAsPlainText("x^2 + 1")).toBe(false);
  });
});
