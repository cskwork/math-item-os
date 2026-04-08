// 추천 이벤트 로깅 서비스 - 교정 경로 추천 기록 (Constitution II: 설명 가능한 추천)
import { prisma } from "@math-item-os/db";
import type { RecType } from "@math-item-os/db";

// -- 입력 타입 정의 --

export interface CreateRecommendationEventInput {
  readonly recType: RecType;
  readonly itemIds: readonly string[];
  readonly reasoning: Readonly<Record<string, unknown>>;
}

export interface UpdateRecommendationFeedbackInput {
  readonly eventId: string;
  readonly accepted: boolean;
  readonly feedback?: string;
}

// -- 1. 추천 이벤트 생성 --

/** 추천 이벤트를 기록한다. reasoning은 Constitution II 필수 필드. */
export async function createRecommendationEvent(
  input: CreateRecommendationEventInput,
  orgId: string,
) {
  const event = await prisma.recommendationEvent.create({
    data: {
      orgId,
      recType: input.recType,
      itemIds: [...input.itemIds],
      reasoning: input.reasoning as Record<string, unknown>,
    },
  });

  return { event };
}

// -- 2. 교정 경로 추천 이벤트 생성 (특화) --

export interface RemediationRecommendationInput {
  readonly misconceptionId: string;
  readonly misconceptionCode: string;
  readonly difficulty: number;
  readonly steps: ReadonlyArray<{
    readonly phase: string;
    readonly itemIds: readonly string[];
    readonly explanation: string;
  }>;
}

/**
 * 교정 경로 추천 결과를 RecommendationEvent로 기록한다.
 * reasoning에 오개념 정보, 난이도 기준, 3단계별 문항 ID 및 설명을 포함.
 */
export async function logRemediationRecommendation(
  input: RemediationRecommendationInput,
  orgId: string,
) {
  // 모든 단계의 문항 ID를 평면화
  const allItemIds = input.steps.flatMap((step) => [...step.itemIds]);

  // 추천 근거 구성 (Constitution II)
  const reasoning = {
    type: "remediation_path",
    misconceptionId: input.misconceptionId,
    misconceptionCode: input.misconceptionCode,
    difficulty: input.difficulty,
    steps: input.steps.map((step) => ({
      phase: step.phase,
      itemCount: step.itemIds.length,
      explanation: step.explanation,
    })),
  };

  return createRecommendationEvent(
    {
      recType: "remediation",
      itemIds: allItemIds,
      reasoning,
    },
    orgId,
  );
}

// -- 3. 추천 피드백 업데이트 --

/** 교사의 추천 수락/거절 피드백을 기록한다. */
export async function updateRecommendationFeedback(
  input: UpdateRecommendationFeedbackInput,
  orgId: string,
) {
  const existing = await prisma.recommendationEvent.findUnique({
    where: { id: input.eventId },
    select: { id: true, orgId: true },
  });

  if (existing == null || existing.orgId !== orgId) {
    return { success: false as const };
  }

  const updated = await prisma.recommendationEvent.update({
    where: { id: input.eventId },
    data: {
      accepted: input.accepted,
      feedback: input.feedback,
    },
  });

  return { event: updated };
}
