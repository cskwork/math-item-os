// 변형 문항 생성 오케스트레이터 서비스
// math-ai 서비스 호출 -> CAS 검증 -> 문항 생성 (is_generated=true) -> 감사 로그
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import { convertLatex } from "./conversion.service";
import { incrementVariantCount } from "./template.service";
import { createAuditLog } from "./audit.service";

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

/** 생성 API 타임아웃 (밀리초) */
const GENERATE_TIMEOUT_MS = 30_000;

/** 검증 API 타임아웃 (밀리초) */
const VERIFY_TIMEOUT_MS = 10_000;

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

/** 생성 요청 입력 */
export interface StartGenerationInput {
  readonly templateId: string;
  readonly count: number;
  readonly params?: {
    readonly solutionSteps?: number;
    readonly coefficientRange?: readonly [number, number];
    readonly includeFractions?: boolean;
    readonly includeNegatives?: boolean;
  };
}

// ─────────────────────────────────────────────────
// 내부 API 응답 타입
// ─────────────────────────────────────────────────

/** math-ai /generate 응답 내 변이 한 건 */
interface GenerateApiVariant {
  readonly body_latex: string;
  readonly params: Record<string, unknown>;
  readonly answer_value: string;
  readonly answer_latex: string;
  readonly seed: number | null;
}

/** math-ai POST /generate 응답 */
interface GenerateApiResponse {
  readonly success: boolean;
  readonly variants: GenerateApiVariant[];
  readonly failed_count: number;
  readonly error: string | null;
}

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
}

const jobStore = new Map<string, MutableJobState>();

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

  // 초기 작업 상태 등록
  jobStore.set(jobId, {
    status: "pending",
    variants: [],
    passRate: 0,
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

/** 템플릿 조회 결과의 축소 타입 */
interface TemplateSnapshot {
  readonly id: string;
  readonly orgId: string;
  readonly title: string;
  readonly bodyTemplate: string;
  readonly parameters: unknown;
  readonly answerTemplate: string;
  readonly constraints: unknown;
}

/**
 * 비동기 생성 워커.
 * a) math-ai /generate 호출
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
    // (a) 상태를 processing으로 전환
    job.status = "processing";

    // (b) math-ai 생성 API 호출
    const generateResponse = await _callMathAiGenerate(template, input);

    if (!generateResponse.success || generateResponse.error) {
      job.status = "failed";
      job.error =
        generateResponse.error ?? "math-ai 서비스에서 생성 실패";
      return;
    }

    const apiVariants = generateResponse.variants;
    if (apiVariants.length === 0) {
      job.status = "completed";
      job.passRate = 0;
      return;
    }

    // (c) 각 변이별 CAS 검증 (병렬)
    const verificationResults = await Promise.allSettled(
      apiVariants.map((v) =>
        _callMathAiVerify(v.body_latex, v.answer_latex),
      ),
    );

    // (d) 검증 결과를 CasVerificationResult로 매핑
    const casResults: CasVerificationResult[] = verificationResults.map(
      (settled) => {
        if (settled.status === "rejected") {
          return {
            passed: false,
            answerEquivalence: false,
            solutionUniqueness: false,
            failureReason: `CAS 검증 호출 실패: ${String(settled.reason)}`,
          };
        }

        const resp = settled.value;
        if (!resp.success || !resp.verification) {
          return {
            passed: false,
            answerEquivalence: false,
            solutionUniqueness: false,
            failureReason: resp.error ?? "CAS 검증 실패",
          };
        }

        const v = resp.verification;
        const passed = v.answer_correct && v.answer_equivalence;
        return {
          passed,
          answerEquivalence: v.answer_equivalence,
          solutionUniqueness: v.solution_uniqueness,
          ...(!passed && {
            failureReason: `정답 오류 또는 동치 검증 실패: ${v.explanation}`,
          }),
        };
      },
    );

    // (e) Item + Variant 레코드 생성 (검증 통과 여부 무관하게 모두 저장, 상태만 다름)
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
              generationSeed: apiVariant.seed,
              generationParams: apiVariant.params,
            } as Prisma.InputJsonValue,
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
            changeSummary: "AI 자동 생성",
          },
        });

        // Variant 레코드 생성 (템플릿 <-> 문항 연결)
        await tx.variant.create({
          data: {
            templateId: template.id,
            itemId: item.id,
            paramValues: apiVariant.params as Prisma.InputJsonValue,
            seed: apiVariant.seed != null ? BigInt(apiVariant.seed) : null,
            generationLog: {
              casVerification: cas,
              generatedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
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

    // (g) 작업 상태를 completed로 전환
    const totalGenerated = apiVariants.length;
    job.status = "completed";
    job.variants = generatedVariants;
    job.passRate = totalGenerated > 0 ? passedCount / totalGenerated : 0;
  } catch (error: unknown) {
    // 예외 발생 시 작업 상태를 failed로 전환
    job.status = "failed";
    job.error =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다";
  }
}

// ─────────────────────────────────────────────────
// 4. math-ai 생성 API 호출 (내부)
// ─────────────────────────────────────────────────

/**
 * math-ai POST /generate 호출.
 * 템플릿 데이터를 API 요청 형식으로 변환하여 전송한다.
 */
async function _callMathAiGenerate(
  template: TemplateSnapshot,
  input: StartGenerationInput,
): Promise<GenerateApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    // 템플릿의 parameters를 배열로 변환
    const parameters = Array.isArray(template.parameters)
      ? (template.parameters as Record<string, unknown>[])
      : [];

    // coefficientRange가 있으면 파라미터의 min/max를 오버라이드
    const adjustedParameters =
      input.params?.coefficientRange != null
        ? parameters.map((p) => ({
            ...p,
            min: input.params!.coefficientRange![0],
            max: input.params!.coefficientRange![1],
          }))
        : parameters;

    // constraints 구성
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
      return {
        success: false,
        variants: [],
        failed_count: 0,
        error: `math-ai 생성 서비스 HTTP 오류: ${response.status} ${response.statusText}`,
      };
    }

    return (await response.json()) as GenerateApiResponse;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        variants: [],
        failed_count: 0,
        error: `math-ai 생성 서비스 타임아웃 (${GENERATE_TIMEOUT_MS}ms)`,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      variants: [],
      failed_count: 0,
      error: `math-ai 생성 서비스 호출 실패: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────
// 5. math-ai 검증 API 호출 (내부)
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
