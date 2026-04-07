"use client";

import { useEffect, useRef, memo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

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
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current || preRenderedHtml) return;

    try {
      katex.render(latex, containerRef.current, {
        displayMode,
        throwOnError: false,
        output: "htmlAndMathml",
        strict: false,
      });
    } catch {
      if (containerRef.current) {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex, displayMode, preRenderedHtml]);

  if (preRenderedHtml) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: preRenderedHtml }}
      />
    );
  }

  return (
    <span
      ref={containerRef}
      className={className}
      data-latex={latex}
    />
  );
});

export { KatexRenderer };
export type { KatexRendererProps };
