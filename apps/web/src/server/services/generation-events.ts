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
// 싱글톤 EventEmitter
// ─────────────────────────────────────────────

class GenerationEventEmitter extends EventEmitter {
  constructor() {
    super();
    // 동시 생성 작업을 위해 리스너 상한을 높임
    this.setMaxListeners(50);
  }

  /** 타입 안전한 이벤트 발행 */
  emitGeneration(event: GenerationEvent): void {
    this.emit("generation", event);
  }
}

export const generationEmitter = new GenerationEventEmitter();
