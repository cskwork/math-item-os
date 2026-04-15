// 애니메이션 서비스 - math-ai /animate 엔드포인트 호출
// LaTeX → Manim 코드 변환 요청. 실패 시 예외를 던지지 않고 결과 객체로 반환.

// ─────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────

export interface AnimateResult {
  readonly success: boolean;
  readonly manimCode: string | null;
  readonly summary: string | null;
  readonly error: string | null;
}

/** math-ai /animate 응답 */
interface MathAiAnimateResponse {
  readonly success: boolean;
  readonly manim_code: string | null;
  readonly summary: string | null;
  readonly error: string | null;
}

// ─────────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────────

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** Manim 파이프라인 타임아웃 (밀리초) */
const ANIMATE_TIMEOUT_MS = 60_000;

// ─────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────

export type AnimationStyle = "step_by_step" | "transform" | "graph";

/**
 * Python math-ai 서비스에 LaTeX → Manim 애니메이션 코드 변환 요청.
 * 타임아웃 60초, 실패 시 예외를 던지지 않고 에러 메시지를 반환한다.
 */
export async function animateLatex(
  latex: string,
  style: AnimationStyle,
  durationHint?: number,
): Promise<AnimateResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANIMATE_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      latex,
      animation_style: style,
    };
    if (durationHint !== undefined) {
      body.duration_hint = durationHint;
    }

    const response = await fetch(`${MATH_AI_SERVICE_URL}/animate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        manimCode: null,
        summary: null,
        error: `math-ai 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as MathAiAnimateResponse;

    if (!data.success) {
      return {
        success: false,
        manimCode: null,
        summary: null,
        error: data.error ?? "math-ai 서비스에서 알 수 없는 오류 발생",
      };
    }

    return {
      success: true,
      manimCode: data.manim_code,
      summary: data.summary,
      error: null,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        success: false,
        manimCode: null,
        summary: null,
        error: `math-ai 서비스 타임아웃 (${ANIMATE_TIMEOUT_MS}ms)`,
      };
    }

    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      manimCode: null,
      summary: null,
      error: `math-ai 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
