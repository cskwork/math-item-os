// Anthropic SDK 문항 생성 서비스 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseGenerationResponse,
  generateWithAnthropic,
  type TemplateSnapshot,
  type GenerateApiVariant,
} from "../anthropic-generation.service";

// ─────────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────────

const sampleTemplate: TemplateSnapshot = {
  id: "tmpl-1",
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

const sampleInput = {
  templateId: "tmpl-1",
  count: 3,
  params: {
    coefficientRange: [1, 5] as readonly [number, number],
    includeFractions: true,
    includeNegatives: true,
  },
};

const validJsonResponse = JSON.stringify([
  {
    body_latex: "2x + 3 = 7",
    params: { a: 2, b: 3, c: 7 },
    answer_value: "2",
    answer_latex: "x = 2",
  },
  {
    body_latex: "3x - 1 = 8",
    params: { a: 3, b: -1, c: 8 },
    answer_value: "3",
    answer_latex: "x = 3",
  },
]);

// ─────────────────────────────────────────────
// buildSystemPrompt
// ─────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("시스템 프롬프트에 JSON 출력 형식이 포함된다", () => {
    const prompt = buildSystemPrompt(sampleTemplate);
    expect(prompt).toContain("body_latex");
    expect(prompt).toContain("answer_value");
    expect(prompt).toContain("answer_latex");
    expect(prompt).toContain("JSON");
  });

  it("시스템 프롬프트에 LaTeX 규칙이 포함된다", () => {
    const prompt = buildSystemPrompt(sampleTemplate);
    expect(prompt).toContain("\\frac");
    expect(prompt).toContain("LaTeX");
  });

  it("시스템 프롬프트에 템플릿의 body/answer 구조가 포함된다", () => {
    const prompt = buildSystemPrompt(sampleTemplate);
    expect(prompt).toContain(sampleTemplate.bodyTemplate);
    expect(prompt).toContain(sampleTemplate.answerTemplate);
  });

  it("시스템 프롬프트에 파라미터 스키마가 포함된다", () => {
    const prompt = buildSystemPrompt(sampleTemplate);
    expect(prompt).toContain('"a"');
    expect(prompt).toContain('"b"');
    expect(prompt).toContain('"c"');
  });
});

// ─────────────────────────────────────────────
// buildUserPrompt
// ─────────────────────────────────────────────

describe("buildUserPrompt", () => {
  it("생성 개수가 포함된다", () => {
    const prompt = buildUserPrompt(sampleTemplate, sampleInput);
    expect(prompt).toContain("3");
  });

  it("계수 범위가 포함된다", () => {
    const prompt = buildUserPrompt(sampleTemplate, sampleInput);
    expect(prompt).toContain("1");
    expect(prompt).toContain("5");
  });

  it("분수 포함 여부가 포함된다", () => {
    const prompt = buildUserPrompt(sampleTemplate, sampleInput);
    expect(prompt).toMatch(/분수|fraction/i);
  });

  it("음수 포함 여부가 포함된다", () => {
    const prompt = buildUserPrompt(sampleTemplate, sampleInput);
    expect(prompt).toMatch(/음수|negative/i);
  });

  it("파라미터가 없을 때도 정상 동작한다", () => {
    const inputWithoutParams = { templateId: "tmpl-1", count: 5 };
    const prompt = buildUserPrompt(sampleTemplate, inputWithoutParams);
    expect(prompt).toContain("5");
  });
});

// ─────────────────────────────────────────────
// parseGenerationResponse
// ─────────────────────────────────────────────

describe("parseGenerationResponse", () => {
  it("정상 JSON 배열을 파싱한다", () => {
    const result = parseGenerationResponse(validJsonResponse);
    expect(result.variants).toHaveLength(2);
    expect(result.error).toBeUndefined();
    expect(result.variants[0]!.body_latex).toBe("2x + 3 = 7");
    expect(result.variants[0]!.answer_value).toBe("2");
  });

  it("markdown code fence로 감싸진 JSON을 처리한다", () => {
    const fenced = "```json\n" + validJsonResponse + "\n```";
    const result = parseGenerationResponse(fenced);
    expect(result.variants).toHaveLength(2);
    expect(result.error).toBeUndefined();
  });

  it("backtick만 있는 code fence도 처리한다", () => {
    const fenced = "```\n" + validJsonResponse + "\n```";
    const result = parseGenerationResponse(fenced);
    expect(result.variants).toHaveLength(2);
  });

  it("파싱 불가 시 빈 배열과 에러를 반환한다", () => {
    const result = parseGenerationResponse("이것은 JSON이 아닙니다");
    expect(result.variants).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it("필수 필드가 누락된 항목을 필터링한다", () => {
    const partial = JSON.stringify([
      { body_latex: "2x + 3 = 7", answer_value: "2", answer_latex: "x = 2" },
      { body_latex: "3x - 1 = 8" }, // answer_value, answer_latex 누락
    ]);
    const result = parseGenerationResponse(partial);
    expect(result.variants).toHaveLength(1);
  });

  it("seed 필드를 null로 설정한다 (LLM 생성)", () => {
    const result = parseGenerationResponse(validJsonResponse);
    for (const v of result.variants) {
      expect(v.seed).toBeNull();
    }
  });

  it("params가 없는 항목에 빈 객체를 기본값으로 설정한다", () => {
    const noParams = JSON.stringify([
      { body_latex: "x + 1 = 2", answer_value: "1", answer_latex: "x = 1" },
    ]);
    const result = parseGenerationResponse(noParams);
    expect(result.variants[0]!.params).toEqual({});
  });
});

// ─────────────────────────────────────────────
// generateWithAnthropic (Claude Agent SDK - OAuth)
// ─────────────────────────────────────────────

// query() mock - async generator 패턴
const mockQuery = vi.fn();

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

/** async generator 헬퍼: result 메시지를 yield */
async function* mockResultGenerator(resultText: string) {
  yield { type: "system", subtype: "init", session_id: "mock-session" };
  yield {
    type: "result",
    subtype: "success",
    result: resultText,
    total_cost_usd: 0.001,
  };
}

describe("generateWithAnthropic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("Claude Agent SDK query()를 올바른 파라미터로 호출한다", async () => {
    mockQuery.mockReturnValue(mockResultGenerator(validJsonResponse));

    const { generateWithAnthropic: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, sampleInput);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("3개의 고유한 변형 문항"),
        options: expect.objectContaining({
          maxTurns: 1,
          allowedTools: [],
          model: "sonnet",
        }),
      }),
    );

    expect(result).toHaveLength(2);
  });

  it("빈 응답 시 빈 배열을 반환한다", async () => {
    mockQuery.mockReturnValue(mockResultGenerator("[]"));

    const { generateWithAnthropic: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, sampleInput);
    expect(result).toHaveLength(0);
  });

  it("query() 실패 시 에러를 던진다", async () => {
    async function* failGenerator() {
      yield { type: "result", subtype: "error" };
    }
    mockQuery.mockReturnValue(failGenerator());

    const { generateWithAnthropic: generate } = await import(
      "../anthropic-generation.service"
    );
    await expect(generate(sampleTemplate, sampleInput)).rejects.toThrow(
      "Claude Agent SDK 호출 실패",
    );
  });
});
