// LaTeX 시각화 서비스 - math-ai /visualize 엔드포인트 호출
// SVG 또는 Chart.js JSON을 반환한다.

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface VisualizeResult {
  readonly success: boolean;
  readonly visualizationType: "svg" | "chartjs" | null;
  readonly content: string | null;
  readonly reviewNotes: string | null;
  readonly error: string | null;
}

interface MathAiVisualizeResponse {
  readonly success: boolean;
  readonly visualization_type: "svg" | "chartjs" | null;
  readonly content: string | null;
  readonly review_notes: string | null;
  readonly error: string | null;
}

// ─────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** 시각화 타임아웃 (밀리초) - LLM 파이프라인이 느리므로 30초 */
const VISUALIZE_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────
// 시각화 요청
// ─────────────────────────────────────────────

/**
 * LaTeX 수식을 SVG 또는 Chart.js JSON으로 시각화한다.
 * 타임아웃 30초, 실패 시 예외를 던지지 않고 에러 메시지를 반환한다.
 */
export async function visualizeLatex(
  latex: string,
  vizType: "svg" | "chartjs",
  context?: string,
): Promise<VisualizeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISUALIZE_TIMEOUT_MS);

  try {
    const body: Record<string, string> = {
      latex,
      visualization_type: vizType,
    };
    if (context !== undefined) {
      body.context = context;
    }

    const response = await fetch(`${MATH_AI_SERVICE_URL}/visualize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        visualizationType: null,
        content: null,
        reviewNotes: null,
        error: `math-ai 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as MathAiVisualizeResponse;

    if (!data.success) {
      return {
        success: false,
        visualizationType: null,
        content: null,
        reviewNotes: null,
        error: data.error ?? "math-ai 서비스에서 알 수 없는 오류 발생",
      };
    }

    return {
      success: true,
      visualizationType: data.visualization_type,
      content: data.content,
      reviewNotes: data.review_notes,
      error: null,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        success: false,
        visualizationType: null,
        content: null,
        reviewNotes: null,
        error: `math-ai 서비스 타임아웃 (${VISUALIZE_TIMEOUT_MS}ms)`,
      };
    }

    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      visualizationType: null,
      content: null,
      reviewNotes: null,
      error: `math-ai 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
