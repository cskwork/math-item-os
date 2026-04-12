// animate.service 단위 테스트
// global.fetch 모킹으로 math-ai /animate 호출을 검증
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// SUT import는 fetch stub 뒤에 와야 한다
import { animateLatex } from "../animate.service";
import type { AnimateResult } from "../animate.service";

describe("animateLatex", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("성공 응답 → success=true, manimCode 반환", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        manim_code: "class Scene(Scene): ...",
        summary: "x^2 그래프를 그리는 애니메이션",
        error: null,
      }),
    });

    const result: AnimateResult = await animateLatex(
      "x^2",
      "step_by_step",
    );

    expect(result).toEqual({
      success: true,
      manimCode: "class Scene(Scene): ...",
      summary: "x^2 그래프를 그리는 애니메이션",
      error: null,
    });

    // fetch 호출 검증
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/animate");
    expect(JSON.parse(options.body as string)).toEqual({
      latex: "x^2",
      animation_style: "step_by_step",
    });
  });

  it("durationHint 전달 시 요청 본문에 포함", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        manim_code: "code",
        summary: "summary",
        error: null,
      }),
    });

    await animateLatex("x^2", "transform", 10);

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body).toEqual({
      latex: "x^2",
      animation_style: "transform",
      duration_hint: 10,
    });
  });

  it("math-ai 에러 응답 → success=false, error 전파", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        manim_code: null,
        summary: null,
        error: "지원되지 않는 LaTeX 표현식",
      }),
    });

    const result = await animateLatex("???", "graph");

    expect(result).toEqual({
      success: false,
      manimCode: null,
      summary: null,
      error: "지원되지 않는 LaTeX 표현식",
    });
  });

  it("HTTP 오류 → success=false, 상태 코드 포함 에러", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await animateLatex("x^2", "step_by_step");

    expect(result.success).toBe(false);
    expect(result.manimCode).toBeNull();
    expect(result.error).toContain("500");
  });

  it("타임아웃 → success=false, 타임아웃 에러 메시지", async () => {
    vi.useFakeTimers();

    mockFetch.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new DOMException("The operation was aborted", "AbortError");
            reject(err);
          });
        }),
    );

    const resultPromise = animateLatex("x^2", "step_by_step");

    // 60초 타임아웃을 즉시 트리거
    await vi.advanceTimersByTimeAsync(60_000);

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.manimCode).toBeNull();
    expect(result.error).toContain("타임아웃");

    vi.useRealTimers();
  });

  it("네트워크 장애 → success=false, 우아한 에러 처리", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await animateLatex("x^2", "step_by_step");

    expect(result.success).toBe(false);
    expect(result.manimCode).toBeNull();
    expect(result.error).toContain("fetch failed");
  });
});
