"use client";

import { memo } from "react";
import "katex/dist/katex.min.css";
import { renderKatexHtml } from "./render-katex-html";

interface KatexRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  /** 서버에서 사전 렌더링된 HTML (있으면 hydrate만 수행) */
  preRenderedHtml?: string;
}

/**
 * KaTeX 클라이언트 렌더러
 * - preRenderedHtml이 있으면 서버 렌더링 결과를 그대로 사용 (hydration)
 * - 없으면 클라이언트에서 직접 렌더링
 * - MathML 출력 포함 (접근성)
 */
const KatexRenderer = memo(function KatexRenderer({
  latex,
  displayMode = false,
  className,
  preRenderedHtml,
}: KatexRendererProps) {
  const html = preRenderedHtml ?? renderKatexHtml(latex, displayMode);

  if (html) {
    return (
      <span
        className={className}
        data-latex={latex}
        aria-label={latex}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span className={className} data-latex={latex} aria-label={latex}>
      {latex}
    </span>
  );
});

export { KatexRenderer };
export type { KatexRendererProps };
