import { renderLatex } from "@math-item-os/math-parser";
import { shouldTreatAsPlainText, tokenizeKatexContent } from "./katex-content";

/**
 * 혼합 텍스트/수식을 KaTeX HTML 문자열로 변환한다.
 * 일반 텍스트만 있는 경우 null을 반환한다.
 */
export function renderKatexHtml(
  latex: string,
  displayMode = false,
): string | null {
  const segments = tokenizeKatexContent(latex);
  const hasMathSegment = segments.some((segment) => segment.type === "math");

  if (hasMathSegment) {
    return segments
      .map((segment) =>
        segment.type === "text"
          ? escapeHtml(segment.content)
          : renderLatex(segment.content, {
              displayMode: segment.displayMode,
            }).html,
      )
      .join("");
  }

  if (shouldTreatAsPlainText(latex)) {
    return null;
  }

  return renderLatex(latex, { displayMode }).html;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
