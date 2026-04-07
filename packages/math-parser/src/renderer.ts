import katex from "katex";

export interface RenderOptions {
  displayMode?: boolean;  // true=display math, false=inline
  throwOnError?: boolean; // false=render error message instead of throwing
  output?: "html" | "mathml" | "htmlAndMathml";
}

export interface RenderResult {
  html: string;
  mathml: string | null;
  errors: string[];
}

/**
 * LaTeX 문자열을 KaTeX HTML + MathML로 렌더링 (서버사이드)
 */
export function renderLatex(latex: string, options?: RenderOptions): RenderResult {
  const errors: string[] = [];

  // HTML 렌더링 (MathML 포함)
  let html = "";
  try {
    html = katex.renderToString(latex, {
      displayMode: options?.displayMode ?? false,
      throwOnError: false,
      output: "htmlAndMathml",
      strict: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(message);
    html = `<span class="katex-error" title="${escapeHtml(message)}">${escapeHtml(latex)}</span>`;
  }

  // MathML only 렌더링
  let mathml: string | null = null;
  try {
    mathml = katex.renderToString(latex, {
      displayMode: options?.displayMode ?? false,
      throwOnError: false,
      output: "mathml",
      strict: false,
    });
  } catch {
    // MathML 실패는 비치명적
  }

  return { html, mathml, errors };
}

/**
 * LaTeX 배열을 일괄 렌더링
 */
export function renderLatexBatch(
  items: ReadonlyArray<{ latex: string; displayMode?: boolean }>,
): RenderResult[] {
  return items.map(({ latex, displayMode }) =>
    renderLatex(latex, { displayMode }),
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
