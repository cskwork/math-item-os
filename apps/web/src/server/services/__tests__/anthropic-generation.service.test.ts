// Z.ai Coding API 문항 생성 서비스 단위 테스트
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseGenerationResponse,
  type TemplateSnapshot,
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
// generateWithLLM (Z.ai Coding API)
// ─────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/** Z.ai API SSE streaming 응답 mock 헬퍼 */
function mockZaiResponse(content: string) {
  // SSE 형식으로 청크 생성
  const sseData = [
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ finish_reason: "stop" }] })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  const encoded = new TextEncoder().encode(sseData);

  // AsyncIterable body mock
  const body = {
    async *[Symbol.asyncIterator]() {
      yield encoded;
    },
  };

  return {
    ok: true,
    body,
    text: async () => content,
  };
}

describe("generateWithLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.ZAI_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.ZAI_API_KEY;
  });

  it("Z.ai API를 올바른 파라미터로 호출한다", async () => {
    mockFetch.mockResolvedValue(mockZaiResponse(validJsonResponse));

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, sampleInput);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.z.ai/api/coding/paas/v4/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    // body에 system/user 메시지가 분리되어 포함
    const callBody = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(callBody.model).toBe("glm-4.7");
    expect(callBody.messages).toHaveLength(2);
    expect(callBody.messages[0].role).toBe("system");
    expect(callBody.messages[1].role).toBe("user");
    expect(callBody.messages[1].content).toContain("3개");
    expect(callBody.stream).toBe(true);

    expect(result).toHaveLength(2);
  });

  it("빈 응답 시 빈 배열을 반환한다", async () => {
    mockFetch.mockResolvedValue(mockZaiResponse("[]"));

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, sampleInput);
    expect(result).toHaveLength(0);
  });

  it("HTTP 오류 시 에러를 던진다", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid API key",
    });

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    await expect(generate(sampleTemplate, sampleInput)).rejects.toThrow(
      "Z.ai API HTTP 오류: 401",
    );
  });

  it("ZAI_API_KEY 미설정 시 에러를 던진다", async () => {
    delete process.env.ZAI_API_KEY;

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    await expect(generate(sampleTemplate, sampleInput)).rejects.toThrow(
      "ZAI_API_KEY",
    );
  });

  it("count > 5일 때 배치를 분할하여 순차 호출한다", async () => {
    const makeBatchItems = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        body_latex: `${start + i}x + 1 = ${start + i + 1}`,
        params: { a: start + i },
        answer_value: String(start + i),
        answer_latex: `x = ${start + i}`,
      }));

    mockFetch
      .mockResolvedValueOnce(
        mockZaiResponse(JSON.stringify(makeBatchItems(1, 5))),
      )
      .mockResolvedValueOnce(
        mockZaiResponse(JSON.stringify(makeBatchItems(6, 3))),
      );

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, {
      ...sampleInput,
      count: 8,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(8);
  });

  it("배치 분할 시 각 배치의 count가 올바르다", async () => {
    const makeBatchItems = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        body_latex: `${i}x = ${i}`,
        params: { a: i },
        answer_value: String(i),
        answer_latex: `x = ${i}`,
      }));

    mockFetch
      .mockResolvedValueOnce(
        mockZaiResponse(JSON.stringify(makeBatchItems(5))),
      )
      .mockResolvedValueOnce(
        mockZaiResponse(JSON.stringify(makeBatchItems(5))),
      )
      .mockResolvedValueOnce(
        mockZaiResponse(JSON.stringify(makeBatchItems(2))),
      );

    const { generateWithLLM: generate } = await import(
      "../anthropic-generation.service"
    );
    const result = await generate(sampleTemplate, {
      ...sampleInput,
      count: 12,
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(12);

    // 각 배치의 body에 올바른 count가 포함되는지 확인
    const calls = mockFetch.mock.calls;
    expect(JSON.parse(calls[0]![1].body).messages[1].content).toContain("5개");
    expect(JSON.parse(calls[1]![1].body).messages[1].content).toContain("5개");
    expect(JSON.parse(calls[2]![1].body).messages[1].content).toContain("2개");
  });
});
