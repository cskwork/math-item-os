// deep-solve.service 단위 테스트
// - fetch는 mock (math-ai 서비스 호출 없이 검증)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deepSolve } from "../deep-solve.service";

// ─────────────────────────────────────────────
// 전역 fetch mock
// ─────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─────────────────────────────────────────────
// deepSolve
// ─────────────────────────────────────────────

describe("deepSolve", () => {
  it("정상 응답에서 steps + finalAnswer와 success=true를 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        steps: [
          { step_num: 1, latex: "2x = 4", explanation: "양변에서 2를 나눈다", tool_used: "algebra" },
          { step_num: 2, latex: "x = 2", explanation: "결과", tool_used: null },
        ],
        final_answer: "x = 2",
        verification: "검증 완료",
      }),
    });

    const result = await deepSolve("2x + 2 = 6", "middle");

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps![0]).toEqual({
      stepNum: 1,
      latex: "2x = 4",
      explanation: "양변에서 2를 나눈다",
      toolUsed: "algebra",
    });
    expect(result.finalAnswer).toBe("x = 2");
    expect(result.verification).toBe("검증 완료");
    expect(result.error).toBeUndefined();
  });

  it("show_work=true일 때 요청 body에 show_work: true가 포함된다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        steps: [{ step_num: 1, latex: "x=1", explanation: "답", tool_used: null }],
        final_answer: "x=1",
        verification: null,
      }),
    });

    await deepSolve("x=1", "elementary", true);

    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.show_work).toBe(true);
  });

  it("math-ai가 에러를 반환하면 success=false와 error를 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: "LaTeX 파싱 실패",
      }),
    });

    const result = await deepSolve("invalid{{{", "high");

    expect(result.success).toBe(false);
    expect(result.error).toBe("LaTeX 파싱 실패");
    expect(result.steps).toBeUndefined();
  });

  it("타임아웃 시 success=false와 타임아웃 메시지를 반환한다", async () => {
    mockFetch.mockImplementation(() => {
      const error = new DOMException("The operation was aborted", "AbortError");
      return Promise.reject(error);
    });

    const result = await deepSolve("x^2 = 4", "high");

    expect(result.success).toBe(false);
    expect(result.error).toContain("타임아웃");
  });

  it("네트워크 장애 시 success=false와 에러 메시지를 반환한다", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await deepSolve("x + 1 = 2", "elementary");

    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});
