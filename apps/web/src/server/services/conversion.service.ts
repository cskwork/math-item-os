// 3중 변환 파이프라인 서비스
// LaTeX -> MathML, LaTeX -> SymPy AST, LaTeX -> HTML 변환을 병렬 실행한다.
// SymPy 변환 실패 시에도 나머지 변환은 정상 반환 (우아한 성능 저하).
// 혼합 형식(한국어 + $...$ 수식)도 처리한다.
import { latexToMathml } from "@math-item-os/math-parser";
import { renderLatex } from "@math-item-os/math-parser";
import { tokenizeKatexContent, hasDelimitedMath } from "@math-item-os/math-parser";
import type { KatexSegment } from "@math-item-os/math-parser";

// ─────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────

/** 전체 3중 변환 결과 */
export interface FullConversionResult {
  readonly mathml: string | null;
  readonly sympy: string | null;
  readonly html: string;
  readonly errors: string[];
}

/** math-ai 서비스 응답 */
interface MathAiResponse {
  readonly success: boolean;
  readonly sympy_expr: string | null;
  readonly latex_normalized: string | null;
  readonly error: string | null;
}

/** callMathAiService 내부 반환 */
interface MathAiCallResult {
  readonly sympyExpr: string | null;
  readonly error: string | null;
}

/** 배치 변환 입력 */
interface BatchConversionInput {
  readonly latex: string;
  readonly displayMode?: boolean;
}

// ─────────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────────

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** SymPy 변환 타임아웃 (밀리초) */
const SYMPY_TIMEOUT_MS = 5_000;

// ─────────────────────────────────────────────────
// math-ai HTTP 호출
// ─────────────────────────────────────────────────

/**
 * Python math-ai 서비스에 LaTeX -> SymPy 변환 요청.
 * 타임아웃 5초, 실패 시 예외를 던지지 않고 에러 메시지를 반환한다.
 */
async function callMathAiService(latex: string): Promise<MathAiCallResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYMPY_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${MATH_AI_SERVICE_URL}/convert/latex-to-sympy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        sympyExpr: null,
        error: `math-ai 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as MathAiResponse;

    if (!data.success) {
      return {
        sympyExpr: null,
        error: data.error ?? "math-ai 서비스에서 알 수 없는 오류 발생",
      };
    }

    return { sympyExpr: data.sympy_expr, error: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        sympyExpr: null,
        error: `math-ai 서비스 타임아웃 (${SYMPY_TIMEOUT_MS}ms)`,
      };
    }

    const message = e instanceof Error ? e.message : String(e);
    return {
      sympyExpr: null,
      error: `math-ai 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────
// 단건 변환
// ─────────────────────────────────────────────────

/**
 * 혼합 형식 입력에서 수식 세그먼트만 추출하여 순수 LaTeX로 결합한다.
 * 여러 수식이 있으면 공백으로 연결한다 (MathML/SymPy는 하나의 표현식으로 처리).
 *
 * @returns 추출된 순수 LaTeX, 수식 없으면 null
 */
function extractMathFromMixed(
  segments: readonly KatexSegment[],
): { latex: string; displayMode: boolean } | null {
  const mathSegments = segments.filter(
    (s): s is Extract<KatexSegment, { type: "math" }> => s.type === "math",
  );

  if (mathSegments.length === 0) return null;

  // 첫 번째 수식의 displayMode를 대표값으로 사용
  return {
    latex: mathSegments.map((s) => s.content).join(" "),
    displayMode: mathSegments[0].displayMode,
  };
}

/**
 * LaTeX 문자열을 MathML, SymPy, HTML로 3중 변환한다.
 *
 * 혼합 형식(한국어 + $...$ 수식)이 감지되면 수식 부분만 추출하여 변환한다.
 * MathML/SymPy 변환은 Promise.allSettled로 병렬 실행하며,
 * 개별 변환 실패가 전체 파이프라인을 차단하지 않는다.
 * HTML 렌더링은 항상 수행되며 오류 시에도 에러 표시 HTML을 반환한다.
 */
export async function convertLatex(
  latex: string,
  options?: { displayMode?: boolean },
): Promise<FullConversionResult> {
  const errors: string[] = [];

  // 혼합 형식 감지 및 수식 추출
  const isMixed = hasDelimitedMath(latex);
  const hasKorean = /[가-힣]/.test(latex);
  let pureLatex: string;
  let effectiveDisplayMode: boolean;

  if (isMixed) {
    // $...$, $$...$$, \(...\), \[...\] 구분자가 있는 혼합 형식
    const segments = tokenizeKatexContent(latex);
    const extracted = extractMathFromMixed(segments);

    if (extracted == null) {
      return { mathml: null, sympy: null, html: "", errors: [] };
    }

    pureLatex = extracted.latex;
    effectiveDisplayMode = options?.displayMode ?? extracted.displayMode;
  } else if (hasKorean) {
    // 구분자 없는 순수 한국어 텍스트 — LaTeX가 아님
    return { mathml: null, sympy: null, html: "", errors: [] };
  } else {
    // 순수 LaTeX (구분자·한국어 없음)
    pureLatex = latex;
    effectiveDisplayMode = options?.displayMode ?? false;
  }

  // MathML 변환과 SymPy 변환을 병렬 실행
  const [mathmlSettled, sympySettled] = await Promise.allSettled([
    Promise.resolve(latexToMathml(pureLatex, { displayMode: effectiveDisplayMode })),
    callMathAiService(pureLatex),
  ]);

  // MathML 결과 처리
  let mathml: string | null = null;
  if (mathmlSettled.status === "fulfilled") {
    const result = mathmlSettled.value;
    mathml = result.mathml;
    if (result.errors.length > 0) {
      errors.push(...result.errors.map((e: string) => `[MathML] ${e}`));
    }
  } else {
    errors.push(`[MathML] ${mathmlSettled.reason}`);
  }

  // SymPy 결과 처리
  let sympy: string | null = null;
  if (sympySettled.status === "fulfilled") {
    const result = sympySettled.value;
    sympy = result.sympyExpr;
    if (result.error) {
      errors.push(`[SymPy] ${result.error}`);
    }
  } else {
    errors.push(`[SymPy] ${sympySettled.reason}`);
  }

  // HTML 렌더링 — 혼합 형식은 세그먼트별로 렌더링
  let html: string;
  if (isMixed) {
    html = renderMixedHtml(latex, effectiveDisplayMode, errors);
  } else {
    const renderResult = renderLatex(latex, { displayMode: effectiveDisplayMode });
    if (renderResult.errors.length > 0) {
      errors.push(...renderResult.errors.map((e: string) => `[HTML] ${e}`));
    }
    html = renderResult.html;
  }

  return { mathml, sympy, html, errors };
}

/** 혼합 형식의 각 세그먼트를 개별 렌더링하여 HTML로 합친다. */
function renderMixedHtml(
  input: string,
  _fallbackDisplayMode: boolean,
  errors: string[],
): string {
  const segments = tokenizeKatexContent(input);

  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtml(segment.content);
      }
      const result = renderLatex(segment.content, {
        displayMode: segment.displayMode,
      });
      if (result.errors.length > 0) {
        errors.push(...result.errors.map((e: string) => `[HTML] ${e}`));
      }
      return result.html;
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

// ─────────────────────────────────────────────────
// 배치 변환
// ─────────────────────────────────────────────────

/**
 * 여러 LaTeX 문자열을 병렬로 3중 변환한다.
 */
export async function convertLatexBatch(
  items: ReadonlyArray<BatchConversionInput>,
): Promise<FullConversionResult[]> {
  return Promise.all(
    items.map((item) => convertLatex(item.latex, { displayMode: item.displayMode })),
  );
}
