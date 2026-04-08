// 생성 이벤트 시스템
// generation.service.ts(발행)와 tRPC subscription(수신) 간 브리지
import { EventEmitter } from "node:events";
import { z } from "zod";

// ─────────────────────────────────────────────
// 이벤트 타입 상수
// ─────────────────────────────────────────────

export const GENERATION_EVENT_TYPES = [
  "job_started",
  "variant_generating",
  "variant_generated",
  "cas_verified",
  "job_completed",
  "job_failed",
] as const;

export type GenerationEventType = (typeof GENERATION_EVENT_TYPES)[number];

// ─────────────────────────────────────────────
// 이벤트 인터페이스
// ─────────────────────────────────────────────

export interface GenerationEvent {
  readonly jobId: string;
  readonly type: GenerationEventType;
  readonly data: unknown;
  readonly timestamp: string;
}

// ─────────────────────────────────────────────
// Zod 스키마
// ─────────────────────────────────────────────

export const generationEventSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum(GENERATION_EVENT_TYPES),
  data: z.unknown(),
  timestamp: z.string(),
});

// ─────────────────────────────────────────────
// 싱글톤 EventEmitter + 이벤트 버퍼
// ─────────────────────────────────────────────

/** 터미널 이벤트 후 버퍼 보존 시간 (10분) */
const BUFFER_TTL_MS = 10 * 60 * 1000;

class GenerationEventEmitter extends EventEmitter {
  /** jobId별 이벤트 버퍼 - SSE 구독 시 리플레이용 */
  private readonly eventBuffers = new Map<string, GenerationEvent[]>();

  constructor() {
    super();
    // 동시 생성 작업을 위해 리스너 상한을 높임
    this.setMaxListeners(50);
  }

  /** 타입 안전한 이벤트 발행 (버퍼 저장 후 emit) */
  emitGeneration(event: GenerationEvent): void {
    // 1) 버퍼에 저장
    let buffer = this.eventBuffers.get(event.jobId);
    if (buffer == null) {
      buffer = [];
      this.eventBuffers.set(event.jobId, buffer);
    }
    buffer.push(event);

    // 2) 터미널 이벤트면 TTL 후 버퍼 정리 예약
    if (event.type === "job_completed" || event.type === "job_failed") {
      setTimeout(() => this.clearBuffer(event.jobId), BUFFER_TTL_MS);
    }

    // 3) 라이브 리스너에게 emit
    this.emit("generation", event);
  }

  /** 특정 job의 버퍼된 이벤트 조회 (리플레이용) */
  getBufferedEvents(jobId: string): readonly GenerationEvent[] {
    return this.eventBuffers.get(jobId) ?? [];
  }

  /** 버퍼 삭제 */
  clearBuffer(jobId: string): void {
    this.eventBuffers.delete(jobId);
  }
}

export const generationEmitter = new GenerationEventEmitter();
