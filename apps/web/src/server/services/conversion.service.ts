// 3중 변환 파이프라인 서비스
// LaTeX -> MathML, LaTeX -> SymPy AST, LaTeX -> HTML 변환을 병렬 실행한다.
// SymPy 변환 실패 시에도 나머지 변환은 정상 반환 (우아한 성능 저하).
import { latexToMathml } from "@math-item-os/math-parser";
import { renderLatex } from "@math-item-os/math-parser";

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
 * LaTeX 문자열을 MathML, SymPy, HTML로 3중 변환한다.
 *
 * MathML/SymPy 변환은 Promise.allSettled로 병렬 실행하며,
 * 개별 변환 실패가 전체 파이프라인을 차단하지 않는다.
 * HTML 렌더링은 항상 수행되며 오류 시에도 에러 표시 HTML을 반환한다.
 */
export async function convertLatex(
  latex: string,
  options?: { displayMode?: boolean },
): Promise<FullConversionResult> {
  const errors: string[] = [];

  // MathML 변환과 SymPy 변환을 병렬 실행
  const [mathmlSettled, sympySettled] = await Promise.allSettled([
    Promise.resolve(latexToMathml(latex, { displayMode: options?.displayMode })),
    callMathAiService(latex),
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

  // HTML 렌더링 (항상 실행, renderLatex는 내부적으로 예외 처리)
  const renderResult = renderLatex(latex, {
    displayMode: options?.displayMode,
  });
  if (renderResult.errors.length > 0) {
    errors.push(...renderResult.errors.map((e: string) => `[HTML] ${e}`));
  }

  return {
    mathml,
    sympy,
    html: renderResult.html,
    errors,
  };
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
