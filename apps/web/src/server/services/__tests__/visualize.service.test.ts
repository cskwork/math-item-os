// visualize.service 단위 테스트
// - global.fetch를 mock하여 math-ai 서비스 호출 검증
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// fetch mock 설정
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { visualizeLatex } from "../visualize.service";

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe("visualizeLatex - SVG 성공", () => {
  it("SVG 응답을 정상 반환한다", async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        visualization_type: "svg",
        content: svgContent,
        review_notes: "Graph of quadratic function",
        error: null,
      }),
    });

    const result = await visualizeLatex("x^2 + 1", "svg");

    expect(result).toEqual({
      success: true,
      visualizationType: "svg",
      content: svgContent,
      reviewNotes: "Graph of quadratic function",
      error: null,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain("/visualize");
    expect(JSON.parse(options.body)).toEqual({
      latex: "x^2 + 1",
      visualization_type: "svg",
    });
  });
});

describe("visualizeLatex - Chart.js 성공", () => {
  it("Chart.js JSON 응답을 정상 반환한다", async () => {
    const chartContent = JSON.stringify({
      type: "line",
      data: { labels: [1, 2], datasets: [{ data: [1, 4] }] },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        visualization_type: "chartjs",
        content: chartContent,
        review_notes: null,
        error: null,
      }),
    });

    const result = await visualizeLatex("y = 2x", "chartjs", "linear function");

    expect(result.success).toBe(true);
    expect(result.visualizationType).toBe("chartjs");
    expect(result.content).toBe(chartContent);
    expect(result.error).toBeNull();
    // context가 body에 포함되는지 검증
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.context).toBe("linear function");
  });
});

describe("visualizeLatex - math-ai 오류 응답", () => {
  it("math-ai가 success=false를 반환하면 에러를 전파한다", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        visualization_type: null,
        content: null,
        review_notes: null,
        error: "Unsupported LaTeX expression",
      }),
    });

    const result = await visualizeLatex("invalid", "svg");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unsupported LaTeX expression");
    expect(result.content).toBeNull();
  });
});

describe("visualizeLatex - 타임아웃", () => {
  it("30초 타임아웃 시 graceful 에러를 반환한다", async () => {
    mockFetch.mockImplementation(() => {
      const error = new DOMException("The operation was aborted", "AbortError");
      return Promise.reject(error);
    });

    const result = await visualizeLatex("x^2", "svg");

    expect(result.success).toBe(false);
    expect(result.error).toContain("타임아웃");
    expect(result.content).toBeNull();
  });
});

describe("visualizeLatex - 네트워크 실패", () => {
  it("네트워크 오류 시 graceful 에러를 반환한다", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await visualizeLatex("x^2", "svg");

    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.content).toBeNull();
  });
});

describe("visualizeLatex - HTTP 오류", () => {
  it("HTTP 500 응답 시 에러를 반환한다", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await visualizeLatex("x^2", "svg");

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
    expect(result.content).toBeNull();
  });
});
