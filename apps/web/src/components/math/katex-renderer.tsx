"use client";

import { memo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  shouldTreatAsPlainText,
  tokenizeKatexContent,
} from "./katex-content";

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
  if (preRenderedHtml) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: preRenderedHtml }}
      />
    );
  }

  const segments = tokenizeKatexContent(latex);
  const hasMixedSegments = segments.some((segment) => segment.type === "math");

  if (hasMixedSegments) {
    return (
      <span className={className} data-latex={latex}>
        {segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={`text-${index}`}>{segment.content}</span>;
          }

          try {
            const html = katex.renderToString(segment.content, {
              displayMode: segment.displayMode,
              throwOnError: false,
              output: "htmlAndMathml",
              strict: false,
            });

            return (
              <span
                key={`math-${index}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <span key={`math-${index}`}>{segment.content}</span>;
          }
        })}
      </span>
    );
  }

  if (shouldTreatAsPlainText(latex)) {
    return (
      <span className={className} data-latex={latex}>
        {latex}
      </span>
    );
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
      strict: false,
    });

    return (
      <span
        className={className}
        data-latex={latex}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return (
      <span className={className} data-latex={latex}>
        {latex}
      </span>
    );
  }
});

export { KatexRenderer };
export type { KatexRendererProps };
