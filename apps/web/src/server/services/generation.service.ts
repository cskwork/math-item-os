// 변형 문항 생성 오케스트레이터 서비스
// 자동 전략 감지: SymPy 가능 -> math-ai, 불가 -> Claude Agent SDK
// CAS 검증 -> 문항 생성 (is_generated=true) -> 감사 로그
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import { convertLatex } from "./conversion.service";
import { incrementVariantCount } from "./template.service";
import { createAuditLog } from "./audit.service";
import {
  generateWithAnthropic,
  type GenerateApiVariant,
  type TemplateSnapshot,
  type StartGenerationInput,
} from "./anthropic-generation.service";
import { generationEmitter, type GenerationEvent } from "./generation-events";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─────────────────────────────────────────────────
// 환경 변수
// ─────────────────────────────────────────────────

const MATH_AI_SERVICE_URL =
  process.env.MATH_AI_SERVICE_URL ?? "http://localhost:8000";

/** 검증 API 타임아웃 (밀리초) */
const VERIFY_TIMEOUT_MS = 10_000;

/** 생성 API 타임아웃 (밀리초) - math-ai용 */
const GENERATE_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────────
// 생성 전략 자동 감지
// ─────────────────────────────────────────────────

export type GenerationStrategy = "sympy" | "llm";

/**
 * 템플릿 구조를 분석하여 SymPy(파라미터 치환) 가능 여부를 판단한다.
 *
 * SymPy 가능 조건 (모두 충족):
 * - parameters 배열에 min/max가 있는 숫자 파라미터가 1개 이상
 * - bodyTemplate에 {{param}} 플레이스홀더가 존재
 * - answerTemplate이 비어있지 않음
 *
 * 하나라도 미충족 시 LLM 전략 사용.
 */
export function detectStrategy(template: TemplateSnapshot): GenerationStrategy {
  // 1. 파라미터 배열 검증
  if (!Array.isArray(template.parameters) || template.parameters.length === 0) {
    return "llm";
  }

  const params = template.parameters as Record<string, unknown>[];
  const hasNumericParams = params.every(
    (p) =>
      typeof p.name === "string" &&
      typeof p.min === "number" &&
      typeof p.max === "number",
  );

  if (!hasNumericParams) {
    return "llm";
  }

  // 2. bodyTemplate에 플레이스홀더 존재 여부
  const placeholderPattern = /\{\{(\w+)\}\}/g;
  const bodyPlaceholders = template.bodyTemplate.match(placeholderPattern);

  if (bodyPlaceholders == null || bodyPlaceholders.length === 0) {
    return "llm";
  }

  // 3. answerTemplate 존재 여부
  if (
    typeof template.answerTemplate !== "string" ||
    template.answerTemplate.trim().length === 0
  ) {
    return "llm";
  }

  return "sympy";
}

// ─────────────────────────────────────────────────
// 공개 타입 정의
// ─────────────────────────────────────────────────

/** CAS 검증 결과 */
export interface CasVerificationResult {
  readonly passed: boolean;
  readonly answerEquivalence: boolean;
  readonly solutionUniqueness: boolean;
  readonly failureReason?: string;
}

/** 생성된 변이 + 검증 결과 */
export interface GeneratedVariant {
  readonly itemId: string;
  readonly bodyLatex: string;
  readonly params: Record<string, unknown>;
  readonly answerValue: string;
  readonly answerLatex: string;
  readonly casVerification: CasVerificationResult;
}

/** 생성 작업 상태 */
export type GenerationJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 생성 작업 결과 */
export interface GenerationJobResult {
  readonly status: GenerationJobStatus;
  readonly variants: GeneratedVariant[];
  readonly passRate: number;
  readonly error?: string;
}

// re-export (admin.router.ts에서 사용)
export type { StartGenerationInput } from "./anthropic-generation.service";

// ─────────────────────────────────────────────────
// 내부 API 응답 타입 (CAS 검증용)
// ─────────────────────────────────────────────────

/** math-ai POST /generate/verify 응답 */
interface VerifyApiResponse {
  readonly success: boolean;
  readonly verification: {
    readonly answer_correct: boolean;
    readonly answer_equivalence: boolean;
    readonly solution_uniqueness: boolean;
    readonly explanation: string;
  } | null;
  readonly error: string | null;
}

// ─────────────────────────────────────────────────
// 작업 저장소 (MVP: 인메모리 Map, 추후 BullMQ 교체)
// ─────────────────────────────────────────────────

/** 내부 가변 작업 상태 (Map 내에서만 사용) */
interface MutableJobState {
  status: GenerationJobStatus;
  variants: GeneratedVariant[];
  passRate: number;
  error?: string;
  createdAt: number;
}

const jobStore = new Map<string, MutableJobState>();

/** 완료/실패 작업의 TTL (10분) */
const JOB_TTL_MS = 10 * 60 * 1000;
/** 최대 동시 작업 수 */
const MAX_JOBS = 200;

/** TTL 만료 작업 및 초과 작업 정리 */
function evictStaleJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobStore) {
    const isTerminal = job.status === "completed" || job.status === "failed";
    if (isTerminal && now - job.createdAt > JOB_TTL_MS) {
      jobStore.delete(id);
    }
  }
  // 상한 초과 시 가장 오래된 terminal job부터 삭제
  if (jobStore.size > MAX_JOBS) {
    const sorted = [...jobStore.entries()]
      .filter(([, j]) => j.status === "completed" || j.status === "failed")
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);
    for (const [id] of sorted) {
      jobStore.delete(id);
      if (jobStore.size <= MAX_JOBS) break;
    }
  }
}

// ─────────────────────────────────────────────────
// 이벤트 발행 헬퍼
// ─────────────────────────────────────────────────

function emitEvent(
  jobId: string,
  type: GenerationEvent["type"],
  data: unknown,
): void {
  generationEmitter.emitGeneration({
    jobId,
    type,
    data,
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────
// 0. 전략 사전 감지 (공개)
// ─────────────────────────────────────────────────

/**
 * 템플릿 ID로 전략을 사전 감지한다.
 * UI에서 생성 전 전략 뱃지 표시용.
 */
export async function detectStrategyForTemplate(
  templateId: string,
  orgId: string,
): Promise<{ readonly strategy: GenerationStrategy; readonly warnings: readonly string[] }> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      orgId: true,
      title: true,
      bodyTemplate: true,
      parameters: true,
      answerTemplate: true,
      constraints: true,
    },
  });

  if (!template) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `템플릿을 찾을 수 없습니다: ${templateId}`,
    });
  }

  if (template.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 템플릿이 아닙니다",
    });
  }

  const strategy = detectStrategy(template as TemplateSnapshot);
  return { strategy, warnings: [] };
}

// ─────────────────────────────────────────────────
// 1. 생성 작업 시작 (공개)
// ─────────────────────────────────────────────────

/**
 * 변형 생성 작업을 시작한다.
 * jobId를 즉시 반환하고, 실제 생성은 비동기로 진행한다.
 */
export async function startGenerationJob(
  input: StartGenerationInput,
  performedBy: string,
  orgId: string,
): Promise<{ readonly jobId: string }> {
  // 템플릿 존재 여부 및 소속 조직 확인
  const template = await prisma.template.findUnique({
    where: { id: input.templateId },
    select: {
      id: true,
      orgId: true,
      title: true,
      bodyTemplate: true,
      parameters: true,
      answerTemplate: true,
      constraints: true,
    },
  });

  if (!template) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `템플릿을 찾을 수 없습니다: ${input.templateId}`,
    });
  }

  if (template.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 템플릿이 아닙니다",
    });
  }

  const jobId = randomUUID();

  // 오래된 작업 정리
  evictStaleJobs();

  // 초기 작업 상태 등록
  jobStore.set(jobId, {
    status: "pending",
    variants: [],
    passRate: 0,
    createdAt: Date.now(),
  });

  // 비동기 생성 시작 (fire-and-forget)
  void _processGeneration(jobId, template, input, performedBy, orgId);

  return { jobId };
}

// ─────────────────────────────────────────────────
// 2. 생성 결과 조회 (공개)
// ─────────────────────────────────────────────────

/**
 * jobId로 생성 작업의 현재 상태와 결과를 조회한다.
 */
export function getGenerationResult(jobId: string): GenerationJobResult {
  const job = jobStore.get(jobId);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `생성 작업을 찾을 수 없습니다: ${jobId}`,
    });
  }

  return {
    status: job.status,
    variants: job.variants,
    passRate: job.passRate,
    ...(job.error != null && { error: job.error }),
  };
}

// ─────────────────────────────────────────────────
// 3. 비동기 생성 처리 (내부)
// ─────────────────────────────────────────────────

/**
 * 비동기 생성 워커.
 * a) Anthropic SDK로 변이 생성
 * b) 각 변이별 CAS 검증
 * c) Item + Variant 레코드 생성
 * d) variantCount 갱신
 * e) 감사 로그 기록
 */
async function _processGeneration(
  jobId: string,
  template: TemplateSnapshot,
  input: StartGenerationInput,
  performedBy: string,
  orgId: string,
): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;

  try {
    // (a) 상태를 processing으로 전환 + 이벤트 발행
    job.status = "processing";

    // (b) 전략 결정: 오버라이드 우선, 없으면 자동 감지
    const strategy = input.strategyOverride ?? detectStrategy(template);
    emitEvent(jobId, "job_started", { totalCount: input.count, strategy });
    emitEvent(jobId, "variant_generating", { index: 0, strategy });

    const apiVariants =
      strategy === "sympy"
        ? await _callMathAiGenerate(template, input)
        : await generateWithAnthropic(template, input);

    if (apiVariants.length === 0) {
      job.status = "completed";
      job.passRate = 0;
      emitEvent(jobId, "job_completed", { variantCount: 0, passRate: 0 });
      return;
    }

    // 생성된 변이 이벤트 발행
    for (let i = 0; i < apiVariants.length; i++) {
      emitEvent(jobId, "variant_generated", {
        index: i,
        bodyLatex: apiVariants[i]!.body_latex,
        answerValue: apiVariants[i]!.answer_value,
      });
    }

    // (c) 각 변이별 CAS 검증 (병렬)
    const verificationResults = await Promise.allSettled(
      apiVariants.map((v) =>
        _callMathAiVerify(v.body_latex, v.answer_latex),
      ),
    );

    // (d) 검증 결과를 CasVerificationResult로 매핑 + 이벤트 발행
    const casResults: CasVerificationResult[] = verificationResults.map(
      (settled, index) => {
        if (settled.status === "rejected") {
          const result: CasVerificationResult = {
            passed: false,
            answerEquivalence: false,
            solutionUniqueness: false,
            failureReason: `CAS 검증 호출 실패: ${String(settled.reason)}`,
          };
          emitEvent(jobId, "cas_verified", { index, ...result });
          return result;
        }

        const resp = settled.value;
        if (!resp.success || !resp.verification) {
          const result: CasVerificationResult = {
            passed: false,
            answerEquivalence: false,
            solutionUniqueness: false,
            failureReason: resp.error ?? "CAS 검증 실패",
          };
          emitEvent(jobId, "cas_verified", { index, ...result });
          return result;
        }

        const v = resp.verification;
        const passed = v.answer_correct && v.answer_equivalence;
        const result: CasVerificationResult = {
          passed,
          answerEquivalence: v.answer_equivalence,
          solutionUniqueness: v.solution_uniqueness,
          ...(!passed && {
            failureReason: `정답 오류 또는 동치 검증 실패: ${v.explanation}`,
          }),
        };
        emitEvent(jobId, "cas_verified", { index, ...result });
        return result;
      },
    );

    // (e) Item + Variant 레코드 생성
    const generatedVariants: GeneratedVariant[] = [];
    let passedCount = 0;

    for (let i = 0; i < apiVariants.length; i++) {
      const apiVariant = apiVariants[i]!;
      const cas = casResults[i]!;

      if (cas.passed) {
        passedCount++;
      }

      // 3중 변환 실행 (트랜잭션 외부 - 외부 서비스 호출 포함)
      const conversion = await convertLatex(apiVariant.body_latex);

      // 트랜잭션: Item + Variant 원자적 생성
      const { itemId } = await prisma.$transaction(async (tx: TxClient) => {
        // Constitution III: AI 생성 문항은 is_generated=true, status=draft
        const item = await tx.item.create({
          data: {
            orgId,
            bodyLatex: apiVariant.body_latex,
            bodyMathml: conversion.mathml,
            bodySympy: conversion.sympy,
            bodyHtml: conversion.html,
            answer: {
              value: apiVariant.answer_value,
              format: "exact_value",
              latex: apiVariant.answer_latex,
            } as Prisma.InputJsonValue,
            schoolLevel: "middle",
            grade: 1,
            itemType: "short_answer",
            answerFormat: "exact_value",
            solutionSteps: input.params?.solutionSteps ?? undefined,
            status: "draft",
            isGenerated: true,
            templateId: template.id,
            currentVersion: 1,
            createdBy: performedBy,
            metadata: {
              casVerification: cas,
              generationSeed: null,
              generationParams: apiVariant.params,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        // 초기 버전 이력 생성
        await tx.itemVersion.create({
          data: {
            itemId: item.id,
            version: 1,
            bodyLatex: apiVariant.body_latex,
            answer: {
              value: apiVariant.answer_value,
              latex: apiVariant.answer_latex,
            } as Prisma.InputJsonValue,
            changeSummary:
              strategy === "sympy"
                ? "자동 생성 (SymPy 파라미터 치환)"
                : "자동 생성 (Claude Agent SDK)",
          },
        });

        // Variant 레코드 생성 (템플릿 <-> 문항 연결)
        await tx.variant.create({
          data: {
            templateId: template.id,
            itemId: item.id,
            paramValues: apiVariant.params as unknown as Prisma.InputJsonValue,
            seed: null,
            generationLog: {
              casVerification: cas,
              generatedAt: new Date().toISOString(),
              strategy,
              seed: apiVariant.seed,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return { itemId: item.id };
      });

      // 감사 로그 기록 (트랜잭션 외부 - 독립적 기록)
      await createAuditLog({
        orgId,
        tableName: "items",
        recordId: itemId,
        action: "generate",
        performedBy,
        newData: {
          templateId: template.id,
          bodyLatex: apiVariant.body_latex,
          answerValue: apiVariant.answer_value,
          casPassed: cas.passed,
          strategy,
        },
      });

      generatedVariants.push({
        itemId,
        bodyLatex: apiVariant.body_latex,
        params: apiVariant.params,
        answerValue: apiVariant.answer_value,
        answerLatex: apiVariant.answer_latex,
        casVerification: cas,
      });
    }

    // (f) 템플릿의 variantCount 갱신
    if (generatedVariants.length > 0) {
      await incrementVariantCount(template.id, generatedVariants.length);
    }

    // (g) 작업 상태를 completed로 전환 + 이벤트 발행
    const totalGenerated = apiVariants.length;
    job.status = "completed";
    job.variants = generatedVariants;
    job.passRate = totalGenerated > 0 ? passedCount / totalGenerated : 0;

    emitEvent(jobId, "job_completed", {
      variantCount: generatedVariants.length,
      passRate: job.passRate,
    });
  } catch (error: unknown) {
    // 예외 발생 시 작업 상태를 failed로 전환 + 이벤트 발행
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다";

    job.status = "failed";
    job.error = errorMessage;

    emitEvent(jobId, "job_failed", { error: errorMessage });
  }
}

// ─────────────────────────────────────────────────
// 4. math-ai 검증 API 호출 (내부 - CAS 검증은 Python SymPy 유지)
// ─────────────────────────────────────────────────

/**
 * math-ai POST /generate/verify 호출.
 * 방정식과 정답의 동치성을 CAS로 검증한다.
 */
async function _callMathAiVerify(
  equationLatex: string,
  answerLatex: string,
): Promise<VerifyApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const requestBody = {
      equation_latex: equationLatex,
      answer_latex: answerLatex,
      check_equivalence: true,
    };

    const response = await fetch(
      `${MATH_AI_SERVICE_URL}/generate/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return {
        success: false,
        verification: null,
        error: `math-ai 검증 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    return (await response.json()) as VerifyApiResponse;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        verification: null,
        error: `math-ai 검증 서비스 타임아웃 (${VERIFY_TIMEOUT_MS}ms)`,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      verification: null,
      error: `math-ai 검증 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────
// 5. math-ai 생성 API 호출 (SymPy 전략용)
// ─────────────────────────────────────────────────

/** math-ai POST /generate 응답 */
interface GenerateApiResponse {
  readonly success: boolean;
  readonly variants: GenerateApiVariant[];
  readonly failed_count: number;
  readonly error: string | null;
}

/**
 * math-ai POST /generate 호출.
 * SymPy 기반 파라미터 치환으로 변이를 생성한다.
 */
async function _callMathAiGenerate(
  template: TemplateSnapshot,
  input: StartGenerationInput,
): Promise<GenerateApiVariant[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    const parameters = Array.isArray(template.parameters)
      ? (template.parameters as Record<string, unknown>[])
      : [];

    const adjustedParameters =
      input.params?.coefficientRange != null
        ? parameters.map((p) => ({
            ...p,
            min: input.params!.coefficientRange![0],
            max: input.params!.coefficientRange![1],
          }))
        : parameters;

    const baseConstraints =
      typeof template.constraints === "object" && template.constraints != null
        ? (template.constraints as Record<string, unknown>)
        : {};

    const mergedConstraints = {
      ...baseConstraints,
      ...(input.params?.includeFractions != null && {
        include_fractions: input.params.includeFractions,
      }),
      ...(input.params?.includeNegatives != null && {
        include_negatives: input.params.includeNegatives,
      }),
    };

    const requestBody = {
      body_template: template.bodyTemplate,
      parameters: adjustedParameters,
      answer_template: template.answerTemplate,
      constraints: mergedConstraints,
      count: input.count,
      seed: null,
    };

    const response = await fetch(`${MATH_AI_SERVICE_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `math-ai 생성 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as GenerateApiResponse;

    if (!data.success || data.error) {
      throw new Error(data.error ?? "math-ai 서비스에서 생성 실패");
    }

    return data.variants;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`math-ai 생성 서비스 타임아웃 (${GENERATE_TIMEOUT_MS}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
