// 생성 이벤트 시스템 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generationEmitter,
  type GenerationEvent,
  generationEventSchema,
  GENERATION_EVENT_TYPES,
} from "../generation-events";

describe("GenerationEventEmitter", () => {
  beforeEach(() => {
    generationEmitter.removeAllListeners();
  });

  // ─────────────────────────────────────────────
  // 이벤트 발행/수신
  // ─────────────────────────────────────────────

  it("job_started 이벤트를 발행하고 수신한다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "test-job-1",
      type: "job_started",
      data: { totalCount: 5 },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emit("generation", event);

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe("job_started");
    expect(received[0]!.jobId).toBe("test-job-1");
  });

  it("variant_generated 이벤트에 인덱스와 LaTeX가 포함된다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "test-job-2",
      type: "variant_generated",
      data: {
        index: 0,
        bodyLatex: "x^2 + 3x + 2 = 0",
        answerValue: "-1, -2",
      },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emit("generation", event);

    expect(received).toHaveLength(1);
    const payload = received[0]!.data as {
      index: number;
      bodyLatex: string;
      answerValue: string;
    };
    expect(payload.index).toBe(0);
    expect(payload.bodyLatex).toBe("x^2 + 3x + 2 = 0");
    expect(payload.answerValue).toBe("-1, -2");
  });

  it("cas_verified 이벤트에 pass/fail 상태가 포함된다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "test-job-3",
      type: "cas_verified",
      data: { index: 0, passed: true, answerEquivalence: true },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emit("generation", event);

    expect(received).toHaveLength(1);
    const payload = received[0]!.data as {
      index: number;
      passed: boolean;
      answerEquivalence: boolean;
    };
    expect(payload.passed).toBe(true);
    expect(payload.answerEquivalence).toBe(true);
  });

  it("job_completed 이벤트에 variants와 passRate가 포함된다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "test-job-4",
      type: "job_completed",
      data: { variantCount: 5, passRate: 0.8 },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emit("generation", event);

    expect(received).toHaveLength(1);
    const payload = received[0]!.data as {
      variantCount: number;
      passRate: number;
    };
    expect(payload.variantCount).toBe(5);
    expect(payload.passRate).toBe(0.8);
  });

  it("job_failed 이벤트에 에러 메시지가 포함된다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "test-job-5",
      type: "job_failed",
      data: { error: "Anthropic API 호출 실패" },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emit("generation", event);

    expect(received).toHaveLength(1);
    const payload = received[0]!.data as { error: string };
    expect(payload.error).toBe("Anthropic API 호출 실패");
  });

  // ─────────────────────────────────────────────
  // jobId 필터링
  // ─────────────────────────────────────────────

  it("여러 jobId의 이벤트를 구분하여 수신한다", () => {
    const receivedA: GenerationEvent[] = [];
    const receivedB: GenerationEvent[] = [];

    generationEmitter.on("generation", (event: GenerationEvent) => {
      if (event.jobId === "job-a") receivedA.push(event);
      if (event.jobId === "job-b") receivedB.push(event);
    });

    generationEmitter.emit("generation", {
      jobId: "job-a",
      type: "job_started",
      data: { totalCount: 3 },
      timestamp: new Date().toISOString(),
    });

    generationEmitter.emit("generation", {
      jobId: "job-b",
      type: "job_started",
      data: { totalCount: 7 },
      timestamp: new Date().toISOString(),
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
  });

  // ─────────────────────────────────────────────
  // Zod 스키마 검증
  // ─────────────────────────────────────────────

  it("유효한 이벤트를 Zod 스키마로 검증한다", () => {
    const event: GenerationEvent = {
      jobId: "valid-job",
      type: "variant_generating",
      data: { index: 2 },
      timestamp: new Date().toISOString(),
    };

    const result = generationEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("잘못된 type을 가진 이벤트를 거부한다", () => {
    const malformed = {
      jobId: "bad-job",
      type: "invalid_type",
      data: {},
      timestamp: new Date().toISOString(),
    };

    const result = generationEventSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("jobId가 없는 이벤트를 거부한다", () => {
    const malformed = {
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    };

    const result = generationEventSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  // ─────────────────────────────────────────────
  // 이벤트 타입 상수
  // ─────────────────────────────────────────────

  it("GENERATION_EVENT_TYPES가 모든 이벤트 타입을 포함한다", () => {
    expect(GENERATION_EVENT_TYPES).toContain("job_started");
    expect(GENERATION_EVENT_TYPES).toContain("variant_generating");
    expect(GENERATION_EVENT_TYPES).toContain("variant_generated");
    expect(GENERATION_EVENT_TYPES).toContain("cas_verified");
    expect(GENERATION_EVENT_TYPES).toContain("job_completed");
    expect(GENERATION_EVENT_TYPES).toContain("job_failed");
    expect(GENERATION_EVENT_TYPES).toHaveLength(6);
  });

  // ─────────────────────────────────────────────
  // emitGeneration + 이벤트 버퍼
  // ─────────────────────────────────────────────

  it("emitGeneration으로 발행한 이벤트가 리스너에 전달된다", () => {
    const received: GenerationEvent[] = [];
    generationEmitter.on("generation", (event: GenerationEvent) => {
      received.push(event);
    });

    const event: GenerationEvent = {
      jobId: "emit-test-1",
      type: "job_started",
      data: { totalCount: 3 },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emitGeneration(event);

    expect(received).toHaveLength(1);
    expect(received[0]!.jobId).toBe("emit-test-1");
  });

  it("emitGeneration으로 발행한 이벤트가 버퍼에 저장된다", () => {
    const event: GenerationEvent = {
      jobId: "buffer-test-1",
      type: "job_started",
      data: { totalCount: 2 },
      timestamp: new Date().toISOString(),
    };

    generationEmitter.emitGeneration(event);

    const buffered = generationEmitter.getBufferedEvents("buffer-test-1");
    expect(buffered).toHaveLength(1);
    expect(buffered[0]!.type).toBe("job_started");

    // cleanup
    generationEmitter.clearBuffer("buffer-test-1");
  });

  it("같은 jobId의 여러 이벤트가 순서대로 버퍼에 쌓인다", () => {
    const jobId = "buffer-multi-test";

    generationEmitter.emitGeneration({
      jobId,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });
    generationEmitter.emitGeneration({
      jobId,
      type: "variant_generating",
      data: { index: 0 },
      timestamp: new Date().toISOString(),
    });
    generationEmitter.emitGeneration({
      jobId,
      type: "variant_generated",
      data: { index: 0 },
      timestamp: new Date().toISOString(),
    });

    const buffered = generationEmitter.getBufferedEvents(jobId);
    expect(buffered).toHaveLength(3);
    expect(buffered[0]!.type).toBe("job_started");
    expect(buffered[1]!.type).toBe("variant_generating");
    expect(buffered[2]!.type).toBe("variant_generated");

    generationEmitter.clearBuffer(jobId);
  });

  it("getBufferedEvents가 존재하지 않는 jobId에 대해 빈 배열을 반환한다", () => {
    const buffered = generationEmitter.getBufferedEvents("nonexistent-job");
    expect(buffered).toEqual([]);
  });

  it("clearBuffer가 버퍼를 삭제한다", () => {
    const jobId = "clear-test";
    generationEmitter.emitGeneration({
      jobId,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });

    expect(generationEmitter.getBufferedEvents(jobId)).toHaveLength(1);

    generationEmitter.clearBuffer(jobId);

    expect(generationEmitter.getBufferedEvents(jobId)).toEqual([]);
  });

  it("clearBuffer가 존재하지 않는 jobId에도 에러 없이 동작한다", () => {
    expect(() => generationEmitter.clearBuffer("no-such-job")).not.toThrow();
  });

  it("job_completed 터미널 이벤트 후 TTL 타이머가 설정된다", () => {
    vi.useFakeTimers();
    const jobId = "terminal-completed-test";

    generationEmitter.emitGeneration({
      jobId,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });
    generationEmitter.emitGeneration({
      jobId,
      type: "job_completed",
      data: { variantCount: 3, passRate: 1.0 },
      timestamp: new Date().toISOString(),
    });

    // 버퍼가 아직 남아있음
    expect(generationEmitter.getBufferedEvents(jobId)).toHaveLength(2);

    // TTL(10분) 경과 후 버퍼 정리
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(generationEmitter.getBufferedEvents(jobId)).toEqual([]);

    vi.useRealTimers();
  });

  it("job_failed 터미널 이벤트 후 TTL 타이머가 설정된다", () => {
    vi.useFakeTimers();
    const jobId = "terminal-failed-test";

    generationEmitter.emitGeneration({
      jobId,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });
    generationEmitter.emitGeneration({
      jobId,
      type: "job_failed",
      data: { error: "test failure" },
      timestamp: new Date().toISOString(),
    });

    expect(generationEmitter.getBufferedEvents(jobId)).toHaveLength(2);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(generationEmitter.getBufferedEvents(jobId)).toEqual([]);

    vi.useRealTimers();
  });

  it("서로 다른 jobId의 버퍼가 독립적으로 관리된다", () => {
    const jobA = "independent-a";
    const jobB = "independent-b";

    generationEmitter.emitGeneration({
      jobId: jobA,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });
    generationEmitter.emitGeneration({
      jobId: jobB,
      type: "job_started",
      data: {},
      timestamp: new Date().toISOString(),
    });

    generationEmitter.clearBuffer(jobA);

    expect(generationEmitter.getBufferedEvents(jobA)).toEqual([]);
    expect(generationEmitter.getBufferedEvents(jobB)).toHaveLength(1);

    generationEmitter.clearBuffer(jobB);
  });
});
