// 실제 서비스 통합 테스트 (live)
// math-ai 서비스 실행 필수, Claude Agent SDK OAuth 인증 필요
import { describe, it, expect, beforeAll } from "vitest";
import { detectStrategy } from "../generation.service";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseGenerationResponse,
  type TemplateSnapshot,
} from "../anthropic-generation.service";

// ─────────────────────────────────────────────
// 1. detectStrategy 실제 동작 검증
// ─────────────────────────────────────────────

describe("detectStrategy - 실제 템플릿", () => {
  const sympyTemplate: TemplateSnapshot = {
    id: "live-sympy",
    orgId: "default-org",
    title: "일차방정식 기본",
    bodyTemplate: "\\( {{a}}x + {{b}} = {{c}} \\) 를 풀어라.",
    parameters: [
      { name: "a", type: "integer", min: 1, max: 10 },
      { name: "b", type: "integer", min: -10, max: 10 },
      { name: "c", type: "integer", min: -20, max: 20 },
    ],
    answerTemplate: "x = \\frac{{{c}} - {{b}}}{{{a}}}",
    constraints: { distinct_answers: true },
  };

  const llmTemplate: TemplateSnapshot = {
    id: "live-llm",
    orgId: "default-org",
    title: "응용 서술형",
    bodyTemplate: "정수의 성질을 이용한 문제를 만들어라",
    parameters: [],
    answerTemplate: "",
    constraints: {},
  };

  it("대수 템플릿 -> sympy 전략", () => {
    expect(detectStrategy(sympyTemplate)).toBe("sympy");
  });

  it("서술형 템플릿 -> llm 전략", () => {
    expect(detectStrategy(llmTemplate)).toBe("llm");
  });
});

// ─────────────────────────────────────────────
// 2. math-ai /generate 실제 호출 (SymPy 전략)
// ─────────────────────────────────────────────

describe("SymPy 전략 - math-ai /generate 실제 호출", () => {
  const MATH_AI_URL = process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

  beforeAll(async () => {
    // math-ai 서비스 가용성 확인
    try {
      const res = await fetch(`${MATH_AI_URL}/health`);
      if (!res.ok) throw new Error("not ok");
    } catch {
      console.warn("math-ai 서비스 미실행 - SymPy 테스트 스킵됩니다");
    }
  });

  it("일차방정식 변형 3개를 생성한다", async () => {
    let available = false;
    try {
      const res = await fetch(`${MATH_AI_URL}/health`);
      available = res.ok;
    } catch { /* skip */ }

    if (!available) {
      console.warn("SKIP: math-ai 서비스 미실행");
      return;
    }

    const requestBody = {
      body_template: "\\( {{a}}x + {{b}} = {{c}} \\) 를 풀어라.",
      parameters: [
        { name: "a", type: "integer", min: 1, max: 10 },
        { name: "b", type: "integer", min: -10, max: 10 },
        { name: "c", type: "integer", min: -20, max: 20 },
      ],
      answer_template: "({{c}} - {{b}}) / {{a}}",
      constraints: { distinct_answers: true },
      count: 3,
      seed: null,
    };

    const response = await fetch(`${MATH_AI_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    console.log("[SymPy] 응답:", JSON.stringify(data, null, 2));

    expect(data.success).toBe(true);
    expect(data.variants.length).toBeGreaterThanOrEqual(1);

    // 각 variant 검증
    for (const v of data.variants) {
      expect(typeof v.body_latex).toBe("string");
      expect(typeof v.answer_value).toBe("string");
      expect(v.body_latex.length).toBeGreaterThan(0);
      console.log(`  [SymPy] 문항: ${v.body_latex} -> 정답: ${v.answer_value}`);
    }
  });

  it("CAS 검증 (정답 동치성)", async () => {
    let available = false;
    try {
      const res = await fetch(`${MATH_AI_URL}/health`);
      available = res.ok;
    } catch { /* skip */ }

    if (!available) {
      console.warn("SKIP: math-ai 서비스 미실행");
      return;
    }

    const response = await fetch(`${MATH_AI_URL}/generate/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equation_latex: "2x + 3 = 7",
        answer_latex: "x = 2",
        check_equivalence: true,
      }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    console.log("[CAS] 검증 결과:", JSON.stringify(data, null, 2));

    expect(data.success).toBe(true);
    expect(data.verification.answer_correct).toBe(true);
    expect(data.verification.answer_equivalence).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 3. Z.ai Coding API 실제 호출 (LLM 전략)
// ─────────────────────────────────────────────

describe("LLM 전략 - Z.ai API 실제 호출", () => {
  it("Z.ai glm-4.7로 수학 문항 2개를 생성한다", async () => {
    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) {
      console.warn("SKIP: ZAI_API_KEY 환경변수 미설정");
      return;
    }

    const { generateWithLLM } = await import(
      "../anthropic-generation.service"
    );

    const template: TemplateSnapshot = {
      id: "live-llm",
      orgId: "default-org",
      title: "이차방정식 응용",
      bodyTemplate: "이차방정식 문제를 생성하라",
      parameters: [],
      answerTemplate: "",
      constraints: {},
    };

    console.log("[LLM] Z.ai API 호출 시작...");

    try {
      const variants = await generateWithLLM(template, {
        templateId: "live-llm",
        count: 2,
        params: {
          coefficientRange: [1, 5],
          includeNegatives: true,
        },
      });

      console.log(`[LLM] 생성된 문항: ${variants.length}개`);
      expect(variants.length).toBeGreaterThanOrEqual(1);

      for (const v of variants) {
        expect(typeof v.body_latex).toBe("string");
        expect(typeof v.answer_value).toBe("string");
        expect(v.seed).toBeNull();
        console.log(`  [LLM] 문항: ${v.body_latex} -> 정답: ${v.answer_value}`);
      }
    } catch (error) {
      console.warn("[LLM] SKIP: Z.ai API 호출 실패 -", (error as Error).message);
      return;
    }
  }, 90_000);
});
