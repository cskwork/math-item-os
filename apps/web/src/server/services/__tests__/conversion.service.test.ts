// conversion.service 단위 테스트 — math-parser + fetch 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// math-parser 모킹 (vi.hoisted로 호이스팅 안전하게 선언)
// KaTeX 의존 함수만 mock, 순수 문자열 파서는 실제 구현 사용
// ─────────────────────────────────────────────
const { mockLatexToMathml, mockRenderLatex } = vi.hoisted(() => ({
  mockLatexToMathml: vi.fn(),
  mockRenderLatex: vi.fn(),
}));

vi.mock("@math-item-os/math-parser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@math-item-os/math-parser")>();
  return {
    ...actual,
    latexToMathml: mockLatexToMathml,
    renderLatex: mockRenderLatex,
  };
});

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
// convertLatex — 혼합 형식 (한국어 + $...$ 수식)
// ─────────────────────────────────────────────

describe("convertLatex — 혼합 형식", () => {
  it("$...$로 감싼 수식을 추출하여 변환한다", async () => {
    const result = await convertLatex("$(-3) + 7$의 값을 구하시오.");

    // 순수 LaTeX "(-3) + 7"만 KaTeX/SymPy에 전달되어야 한다
    expect(mockLatexToMathml).toHaveBeenCalledWith("(-3) + 7", { displayMode: false });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/convert/latex-to-sympy"),
      expect.objectContaining({
        body: JSON.stringify({ latex: "(-3) + 7" }),
      }),
    );
    expect(result.mathml).toBe("<math>x</math>");
    expect(result.sympy).toBe("Symbol('x')");
    expect(result.errors).toEqual([]);
  });

  it("여러 $...$ 수식이 있으면 결합하여 변환한다", async () => {
    const result = await convertLatex("$\\sqrt{5}$와 $\\sqrt{8}$ 사이에 있는 자연수");

    // 두 수식이 공백으로 결합됨
    expect(mockLatexToMathml).toHaveBeenCalledWith(
      "\\sqrt{5} \\sqrt{8}",
      { displayMode: false },
    );
    expect(result.mathml).toBe("<math>x</math>");
  });

  it("$$...$$는 displayMode: true로 처리한다", async () => {
    const result = await convertLatex("$$x^2 + 1$$을 풀어라");

    expect(mockLatexToMathml).toHaveBeenCalledWith("x^2 + 1", { displayMode: true });
    expect(result.mathml).toBe("<math>x</math>");
  });

  it("수식 없는 순수 한국어는 null을 반환한다", async () => {
    const result = await convertLatex("60을 소인수분해하시오.");

    expect(result.mathml).toBeNull();
    expect(result.sympy).toBeNull();
    expect(result.html).toBe("");
    expect(result.errors).toEqual([]);
    expect(mockLatexToMathml).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("혼합 형식 HTML 렌더링은 텍스트와 수식을 별도로 처리한다", async () => {
    const result = await convertLatex("$x^2$의 값");

    // HTML은 혼합 렌더링 경로를 거침
    expect(result.html).toContain("의 값");
    expect(result.html).toContain("<span>x</span>");
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
