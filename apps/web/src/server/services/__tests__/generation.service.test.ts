// generation.service 통합 테스트
// 자동 전략 감지 + 이벤트 발행 + CAS 검증 흐름 검증
import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectStrategy } from "../generation.service";
import { generationEmitter, type GenerationEvent } from "../generation-events";

// ─────────────────────────────────────────────
// detectStrategy 단위 테스트
// ─────────────────────────────────────────────

describe("detectStrategy", () => {
  it("숫자 파라미터 + 플레이스홀더 + answerTemplate -> sympy", () => {
    const result = detectStrategy({
      id: "t1",
      orgId: "org",
      title: "일차방정식",
      bodyTemplate: "{{a}}x + {{b}} = {{c}}",
      parameters: [
        { name: "a", type: "integer", min: 1, max: 10 },
        { name: "b", type: "integer", min: -10, max: 10 },
        { name: "c", type: "integer", min: -20, max: 20 },
      ],
      answerTemplate: "x = ({{c}} - {{b}}) / {{a}}",
      constraints: {},
    });
    expect(result).toBe("sympy");
  });

  it("파라미터가 없으면 -> llm", () => {
    const result = detectStrategy({
      id: "t2",
      orgId: "org",
      title: "서술형",
      bodyTemplate: "다음 문제를 풀어라",
      parameters: [],
      answerTemplate: "",
      constraints: {},
    });
    expect(result).toBe("llm");
  });

  it("min/max가 없는 파라미터 -> llm", () => {
    const result = detectStrategy({
      id: "t3",
      orgId: "org",
      title: "자유형",
      bodyTemplate: "{{topic}}에 대해 설명하라",
      parameters: [{ name: "topic", type: "string" }],
      answerTemplate: "설명",
      constraints: {},
    });
    expect(result).toBe("llm");
  });

  it("플레이스홀더가 없는 bodyTemplate -> llm", () => {
    const result = detectStrategy({
      id: "t4",
      orgId: "org",
      title: "고정 문제",
      bodyTemplate: "2x + 3 = 7을 풀어라",
      parameters: [{ name: "a", min: 1, max: 5 }],
      answerTemplate: "x = 2",
      constraints: {},
    });
    expect(result).toBe("llm");
  });

  it("answerTemplate이 비어있으면 -> llm", () => {
    const result = detectStrategy({
      id: "t5",
      orgId: "org",
      title: "증명",
      bodyTemplate: "{{a}}가 짝수임을 증명하라",
      parameters: [{ name: "a", min: 2, max: 100 }],
      answerTemplate: "",
      constraints: {},
    });
    expect(result).toBe("llm");
  });
});

// ─────────────────────────────────────────────
// Mock: fetch (CAS 검증 API용)
// ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─────────────────────────────────────────────
// Mock: Prisma
// ─────────────────────────────────────────────
vi.mock("@math-item-os/db", () => ({
  prisma: {
    template: {
      findUnique: vi.fn(),
    },
    item: { create: vi.fn() },
    itemVersion: { create: vi.fn() },
    variant: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// ─────────────────────────────────────────────
// Mock: Anthropic 생성 서비스
// ─────────────────────────────────────────────
vi.mock("../anthropic-generation.service", () => ({
  generateWithAnthropic: vi.fn(),
}));

// ─────────────────────────────────────────────
// Mock: 외부 서비스
// ─────────────────────────────────────────────
vi.mock("../conversion.service", () => ({
  convertLatex: vi.fn().mockResolvedValue({
    mathml: "<math></math>",
    sympy: "x + 1",
    html: "<span>x + 1</span>",
  }),
}));

vi.mock("../template.service", () => ({
  incrementVariantCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../audit.service", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe("generation.service (Anthropic 통합)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generationEmitter.removeAllListeners();
  });

  it("startGenerationJob이 jobId를 반환한다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tmpl-1",
      orgId: "default-org",
      title: "테스트 템플릿",
      bodyTemplate: "{{a}}x + {{b}} = 0",
      parameters: [{ name: "a", min: 1, max: 5 }],
      answerTemplate: "x = -{{b}}/{{a}}",
      constraints: {},
    });

    const { startGenerationJob } = await import("../generation.service");

    const result = await startGenerationJob(
      { templateId: "tmpl-1", count: 2 },
      "user-1",
      "default-org",
    );

    expect(result.jobId).toBeDefined();
    expect(typeof result.jobId).toBe("string");
  });

  it("존재하지 않는 템플릿으로 호출하면 NOT_FOUND 에러를 던진다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const { startGenerationJob } = await import("../generation.service");

    await expect(
      startGenerationJob(
        { templateId: "nonexistent", count: 1 },
        "user-1",
        "default-org",
      ),
    ).rejects.toThrow("템플릿을 찾을 수 없습니다");
  });

  it("다른 조직의 템플릿으로 호출하면 FORBIDDEN 에러를 던진다", async () => {
    const { prisma } = await import("@math-item-os/db");
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tmpl-1",
      orgId: "other-org",
      title: "다른 조직 템플릿",
      bodyTemplate: "x = 1",
      parameters: [],
      answerTemplate: "1",
      constraints: {},
    });

    const { startGenerationJob } = await import("../generation.service");

    await expect(
      startGenerationJob(
        { templateId: "tmpl-1", count: 1 },
        "user-1",
        "default-org",
      ),
    ).rejects.toThrow("해당 조직의 템플릿이 아닙니다");
  });

  it("LLM 전략 - 생성 성공 시 이벤트가 올바른 순서로 발행된다", async () => {
    const { prisma } = await import("@math-item-os/db");
    const { generateWithAnthropic } = await import(
      "../anthropic-generation.service"
    );

    // 파라미터 없는 템플릿 -> LLM 전략으로 감지됨
    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tmpl-1",
      orgId: "default-org",
      title: "서술형 문제",
      bodyTemplate: "다음을 증명하라",
      parameters: [],
      answerTemplate: "",
      constraints: {},
    });

    // Anthropic 생성 mock (LLM 경로)
    (generateWithAnthropic as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        body_latex: "2x = 4",
        params: { a: 2, b: 4 },
        answer_value: "2",
        answer_latex: "x = 2",
        seed: null,
      },
    ]);

    // CAS 검증 fetch mock (math-ai /generate/verify)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verification: {
          answer_correct: true,
          answer_equivalence: true,
          solution_uniqueness: true,
          explanation: "정답 확인",
        },
        error: null,
      }),
    });

    // Prisma 트랜잭션 mock
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          item: {
            create: vi.fn().mockResolvedValue({ id: "item-1" }),
          },
          itemVersion: { create: vi.fn().mockResolvedValue({}) },
          variant: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      },
    );

    // 이벤트 수집
    const events: GenerationEvent[] = [];
    generationEmitter.on("generation", (e: GenerationEvent) => {
      events.push(e);
    });

    const { startGenerationJob, getGenerationResult } = await import(
      "../generation.service"
    );

    const { jobId } = await startGenerationJob(
      { templateId: "tmpl-1", count: 1 },
      "user-1",
      "default-org",
    );

    // fire-and-forget이므로 이벤트 수신 대기
    await vi.waitFor(
      () => {
        const result = getGenerationResult(jobId);
        expect(result.status).toBe("completed");
      },
      { timeout: 5000 },
    );

    // 이벤트 순서 검증
    const eventTypes = events
      .filter((e) => e.jobId === jobId)
      .map((e) => e.type);

    expect(eventTypes[0]).toBe("job_started");
    expect(eventTypes).toContain("variant_generated");
    expect(eventTypes).toContain("cas_verified");
    expect(eventTypes[eventTypes.length - 1]).toBe("job_completed");
  });

  it("Anthropic 실패 시 job_failed 이벤트가 발행된다", async () => {
    const { prisma } = await import("@math-item-os/db");
    const { generateWithAnthropic } = await import(
      "../anthropic-generation.service"
    );

    (prisma.template.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tmpl-1",
      orgId: "default-org",
      title: "테스트",
      bodyTemplate: "x = 1",
      parameters: [],
      answerTemplate: "1",
      constraints: {},
    });

    (generateWithAnthropic as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Anthropic API rate limit"),
    );

    const events: GenerationEvent[] = [];
    generationEmitter.on("generation", (e: GenerationEvent) => {
      events.push(e);
    });

    const { startGenerationJob, getGenerationResult } = await import(
      "../generation.service"
    );

    const { jobId } = await startGenerationJob(
      { templateId: "tmpl-1", count: 1 },
      "user-1",
      "default-org",
    );

    await vi.waitFor(
      () => {
        const result = getGenerationResult(jobId);
        expect(result.status).toBe("failed");
      },
      { timeout: 5000 },
    );

    const failEvent = events.find(
      (e) => e.jobId === jobId && e.type === "job_failed",
    );
    expect(failEvent).toBeDefined();
    expect((failEvent!.data as { error: string }).error).toContain(
      "Anthropic API rate limit",
    );
  });
});
