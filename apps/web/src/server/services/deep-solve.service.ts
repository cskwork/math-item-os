// Deep Solve 서비스 - math-ai 멀티에이전트 풀이 파이프라인 호출
// POST /solve → 단계별 풀이 + 최종 답 반환

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface SolutionStep {
  readonly stepNum: number;
  readonly latex: string;
  readonly explanation: string;
  readonly toolUsed?: string;
}

export interface DeepSolveResult {
  readonly success: boolean;
  readonly steps?: readonly SolutionStep[];
  readonly finalAnswer?: string;
  readonly verification?: string;
  readonly error?: string;
}

/** math-ai /solve 응답 */
interface MathAiSolveResponse {
  readonly success: boolean;
  readonly steps?: ReadonlyArray<{
    step_num: number;
    latex: string;
    explanation: string;
    tool_used: string | null;
  }>;
  readonly final_answer?: string;
  readonly verification?: string | null;
  readonly error?: string;
}

// ─────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** 멀티에이전트 파이프라인 타임아웃 (밀리초) */
const DEEP_SOLVE_TIMEOUT_MS = 60_000;

// ─────────────────────────────────────────────
// deepSolve
// ─────────────────────────────────────────────

export async function deepSolve(
  latex: string,
  schoolLevel: "elementary" | "middle" | "high",
  showWork?: boolean,
): Promise<DeepSolveResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEP_SOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(`${MATH_AI_SERVICE_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latex,
        school_level: schoolLevel,
        show_work: showWork ?? true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `math-ai 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as MathAiSolveResponse;

    if (!data.success) {
      return {
        success: false,
        error: data.error ?? "math-ai 서비스에서 알 수 없는 오류 발생",
      };
    }

    return {
      success: true,
      steps: data.steps?.map((s) => ({
        stepNum: s.step_num,
        latex: s.latex,
        explanation: s.explanation,
        toolUsed: s.tool_used ?? undefined,
      })),
      finalAnswer: data.final_answer,
      verification: data.verification ?? undefined,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        success: false,
        error: `math-ai 서비스 타임아웃 (${DEEP_SOLVE_TIMEOUT_MS}ms)`,
      };
    }

    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `math-ai 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
