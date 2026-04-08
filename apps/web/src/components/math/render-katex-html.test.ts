import { describe, expect, it } from "vitest";
import { renderKatexHtml } from "./render-katex-html";

describe("renderKatexHtml", () => {
  it("구분자로 감싼 수식과 설명 문장을 함께 KaTeX HTML로 변환한다", () => {
    const html = renderKatexHtml(
      "$(-3) \\div \\frac{1}{2} \\times (-4)$의 값을 구하시오.",
    );

    expect(html).not.toBeNull();
    expect(html).toContain("katex");
    expect(html).toContain("의 값을 구하시오.");
  });

  it("일반 텍스트만 있으면 HTML 렌더링을 생략한다", () => {
    expect(renderKatexHtml("연결된 문항이 없습니다.")).toBeNull();
  });
});
