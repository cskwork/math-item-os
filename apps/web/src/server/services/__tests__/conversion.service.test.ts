// conversion.service 단위 테스트 — math-parser + fetch 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// math-parser 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// ─────────────────────────────────────────────
const { mockLatexToMathml, mockRenderLatex } = vi.hoisted(() => ({
  mockLatexToMathml: vi.fn(),
  mockRenderLatex: vi.fn(),
}));

vi.mock("@math-item-os/math-parser", () => ({
  latexToMathml: mockLatexToMathml,
  renderLatex: mockRenderLatex,
}));

import { convertLatex, convertLatexBatch } from "../conversion.service";

// ─────────────────────────────────────────────
// fetch 모킹
// ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  // 기본 성공 설정
  mockLatexToMathml.mockReturnValue({ mathml: "<math>x</math>", errors: [] });
  mockRenderLatex.mockReturnValue({ html: "<span>x</span>", errors: [] });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      sympy_expr: "Symbol('x')",
      latex_normalized: "x",
      error: null,
    }),
  });
});

// ─────────────────────────────────────────────
// convertLatex
// ─────────────────────────────────────────────

describe("convertLatex", () => {
  it("3중 변환을 모두 성공적으로 수행한다", async () => {
    const result = await convertLatex("x^2");

    expect(result.mathml).toBe("<math>x</math>");
    expect(result.sympy).toBe("Symbol('x')");
    expect(result.html).toBe("<span>x</span>");
    expect(result.errors).toEqual([]);
  });

  it("displayMode 옵션을 전달한다", async () => {
    await convertLatex("x^2", { displayMode: true });

    expect(mockLatexToMathml).toHaveBeenCalledWith("x^2", { displayMode: true });
    expect(mockRenderLatex).toHaveBeenCalledWith("x^2", { displayMode: true });
  });

  it("MathML 변환 에러를 errors 배열에 포함한다", async () => {
    mockLatexToMathml.mockReturnValue({
      mathml: null,
      errors: ["parse error"],
    });

    const result = await convertLatex("\\invalid");

    expect(result.mathml).toBeNull();
    expect(result.errors).toContain("[MathML] parse error");
  });

  it("SymPy fetch 실패 시 에러를 포함하되 나머지는 정상 반환", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await convertLatex("x");

    expect(result.sympy).toBeNull();
    expect(result.errors.some((e: string) => e.includes("[SymPy]"))).toBe(true);
    expect(result.mathml).toBe("<math>x</math>");
    expect(result.html).toBe("<span>x</span>");
  });

  it("SymPy 서비스가 success: false를 반환하면 에러 포함", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        sympy_expr: null,
        latex_normalized: null,
        error: "unsupported expression",
      }),
    });

    const result = await convertLatex("x");

    expect(result.sympy).toBeNull();
    expect(result.errors).toContain("[SymPy] unsupported expression");
  });

  it("SymPy 서비스가 success: false + error: null이면 기본 에러 메시지", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        sympy_expr: null,
        latex_normalized: null,
        error: null,
      }),
    });

    const result = await convertLatex("x");

    expect(result.errors.some((e: string) => e.includes("알 수 없는 오류"))).toBe(true);
  });

  it("fetch 네트워크 오류 시 에러 메시지를 포함한다", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await convertLatex("x");

    expect(result.sympy).toBeNull();
    expect(result.errors.some((e: string) => e.includes("ECONNREFUSED"))).toBe(true);
  });

  it("fetch AbortError(타임아웃) 시 타임아웃 메시지를 포함한다", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    const result = await convertLatex("x");

    expect(result.sympy).toBeNull();
    expect(result.errors.some((e: string) => e.includes("타임아웃"))).toBe(true);
  });

  it("HTML 렌더링 에러를 errors 배열에 포함한다", async () => {
    mockRenderLatex.mockReturnValue({
      html: "<span class='error'>err</span>",
      errors: ["render warning"],
    });

    const result = await convertLatex("x");

    expect(result.html).toContain("error");
    expect(result.errors).toContain("[HTML] render warning");
  });
});

// ─────────────────────────────────────────────
// convertLatexBatch
// ─────────────────────────────────────────────

describe("convertLatexBatch", () => {
  it("여러 LaTeX를 병렬로 변환한다", async () => {
    const results = await convertLatexBatch([
      { latex: "x" },
      { latex: "y", displayMode: true },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]!.html).toBe("<span>x</span>");
    expect(results[1]!.html).toBe("<span>x</span>");
  });

  it("빈 배열을 전달하면 빈 결과를 반환한다", async () => {
    const results = await convertLatexBatch([]);
    expect(results).toEqual([]);
  });
});
