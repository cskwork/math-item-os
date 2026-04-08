import test from "node:test";
import assert from "node:assert/strict";
import {
  hasDelimitedMath,
  shouldTreatAsPlainText,
  tokenizeKatexContent,
} from "./katex-content";

test("tokenizeKatexContent splits mixed prose and inline math", () => {
  assert.deepEqual(
    tokenizeKatexContent("$(-3) + 7$의 값을 구하시오."),
    [
      { type: "math", content: "(-3) + 7", displayMode: false },
      { type: "text", content: "의 값을 구하시오." },
    ],
  );
});

test("tokenizeKatexContent keeps plain text as a text segment", () => {
  assert.deepEqual(tokenizeKatexContent("60을 소인수분해하시오."), [
    { type: "text", content: "60을 소인수분해하시오." },
  ]);
});

test("hasDelimitedMath detects bracketed math content", () => {
  assert.equal(hasDelimitedMath("\\begin{cases} x+y=1 \\end{cases}"), false);
  assert.equal(hasDelimitedMath("$x+1$을 계산하시오."), true);
  assert.equal(hasDelimitedMath("\\(x+1\\)"), true);
});

test("shouldTreatAsPlainText distinguishes prose from pure math", () => {
  assert.equal(shouldTreatAsPlainText("60을 소인수분해하시오."), true);
  assert.equal(shouldTreatAsPlainText("x^2 + 1"), false);
});
