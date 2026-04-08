// 관리자 tRPC 라우터 - 템플릿/생성/학습지/품질대시보드/검수큐/사용자/감사로그
// 모든 비즈니스 로직은 서비스 레이어에 위임
import { z } from "zod";
import { tracked } from "@trpc/server";
import { createTRPCRouter, reviewerProcedure, adminProcedure } from "../trpc";
import {
  generationEmitter,
  type GenerationEvent,
} from "../services/generation-events";
import {
  listTemplatesSchema,
  generateVariantsSchema,
  getGenerationResultSchema,
  listGenerationJobsSchema,
  detectStrategyInputSchema,
  createAssignmentSchema,
  exportAssignmentSchema,
  paginationSchema,
  assignmentPurposeSchema,
  listAuditLogsSchema,
  listReviewTasksSchema,
  updateReviewTaskSchema,
  listUsersSchema,
  updateUserRoleSchema,
} from "@math-item-os/shared/validators/index";
import {
  listTemplates,
  getTemplateById,
  createTemplate,
} from "../services/template.service";
import {
  startGenerationJob,
  getGenerationResult,
  listGenerationJobs,
  detectStrategyForTemplate,
} from "../services/generation.service";
import {
  createAssignment,
  getAssignmentById,
  listAssignments,
  updateAssignmentItems,
  publishAssignment,
} from "../services/assignment.service";
import { exportAssignment } from "../services/pdf.service";
import { getQualityMetrics } from "../services/quality-metrics.service";
import {
  listReviewTasks,
  updateReviewTask,
} from "../services/review.service";
import { listUsers, updateUserRole } from "../services/user.service";
import { listAuditLogs } from "../services/audit.service";

// MVP 단계에서 사용할 기본 조직 ID
const DEFAULT_ORG_ID = "default-org";

/** 사용자의 조직 ID를 반환한다. MVP에서는 고정값 사용. */
function getOrgId(): string {
  return DEFAULT_ORG_ID;
}

// -- 인라인 스키마 정의 (공유 validators에 없는 것들) --

/** 템플릿 생성 스키마 */
const createTemplateSchema = z.object({
  title: z.string().min(1),
  bodyTemplate: z.string().min(1),
  parameters: z.array(z.record(z.unknown())),
  answerTemplate: z.string(),
  constraints: z.record(z.unknown()).optional(),
});

/** 학습지 목록 조회 스키마 */
const listAssignmentsSchema = paginationSchema.extend({
  purpose: assignmentPurposeSchema.optional(),
});

/** 학습지 문항 업데이트 스키마 */
const updateAssignmentItemsSchema = z.object({
  assignmentId: z.string(),
  itemIds: z.array(z.string()).min(1),
  points: z.array(z.number()).optional(),
});

export const adminRouter = createTRPCRouter({
  // 템플릿 목록 조회 (검수자 이상)
  listTemplates: reviewerProcedure
    .input(listTemplatesSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listTemplates(input, orgId);
    }),

  // 템플릿 상세 조회 (검수자 이상)
  getTemplate: reviewerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getTemplateById(input.id, orgId);
    }),

  // 템플릿 생성 (검수자 이상)
  createTemplate: reviewerProcedure
    .input(createTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createTemplate(input, ctx.user.id, orgId);
    }),

  // 전략 사전 감지 (검수자 이상)
  detectStrategy: reviewerProcedure
    .input(detectStrategyInputSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return detectStrategyForTemplate(input.templateId, orgId);
    }),

  // 변형 문항 생성 - 비동기 (검수자 이상)
  generateVariants: reviewerProcedure
    .input(generateVariantsSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return startGenerationJob(input, ctx.user.id, orgId);
    }),

  // 생성 작업 결과 조회 (검수자 이상)
  getGenerationResult: reviewerProcedure
    .input(getGenerationResultSchema)
    .query(({ input }) => {
      return getGenerationResult(input.jobId);
    }),

  // 생성 작업 목록 조회 (검수자 이상)
  listGenerationJobs: reviewerProcedure
    .input(listGenerationJobsSchema)
    .query(({ input }) => {
      return listGenerationJobs({ limit: input.limit });
    }),

  // 생성 진행 상태 실시간 스트리밍 (SSE subscription)
  // 버퍼 리플레이: 구독 시작 전에 발행된 이벤트도 누락 없이 전달
  onGenerationProgress: reviewerProcedure
    .input(z.object({ jobId: z.string() }))
    .subscription(async function* ({ input, signal }) {
      const { jobId } = input;
      let eventIndex = 0;

      // 1) 먼저 라이브 리스너 등록 (버퍼 조회 중 발행되는 이벤트 축적)
      const liveQueue: GenerationEvent[] = [];
      let resolve: (() => void) | null = null;

      const listener = (event: GenerationEvent) => {
        if (event.jobId !== jobId) return;
        liveQueue.push(event);
        if (resolve != null) {
          resolve();
          resolve = null;
        }
      };

      generationEmitter.on("generation", listener);

      try {
        // 2) 버퍼에서 기존 이벤트 리플레이
        const buffered = generationEmitter.getBufferedEvents(jobId);
        const replayedCount = buffered.length;

        for (const event of buffered) {
          yield tracked(String(eventIndex++), event);

          // 터미널 이벤트가 버퍼에 있으면 즉시 종료
          if (
            event.type === "job_completed" ||
            event.type === "job_failed"
          ) {
            return;
          }
        }

        // 3) 라이브 이벤트 루프
        // 리스너가 버퍼 조회 전에 등록되었으므로 라이브 큐에는
        // 버퍼 이벤트가 중복 포함됨 -> replayedCount만큼 건너뜀
        let skipped = 0;

        // signal abort 리스너를 한 번만 등록
        const onAbort = () => {
          if (resolve != null) {
            resolve();
            resolve = null;
          }
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        while (!signal?.aborted) {
          if (liveQueue.length === 0) {
            await new Promise<void>((r) => {
              resolve = r;
            });
          }

          while (liveQueue.length > 0) {
            const event = liveQueue.shift()!;

            // 버퍼에서 이미 리플레이한 이벤트 건너뜀
            if (skipped < replayedCount) {
              skipped++;
              continue;
            }

            yield tracked(String(eventIndex++), event);

            if (
              event.type === "job_completed" ||
              event.type === "job_failed"
            ) {
              return;
            }
          }
        }
      } finally {
        generationEmitter.off("generation", listener);
      }
    }),

  // 학습지 생성 (검수자 이상)
  createAssignment: reviewerProcedure
    .input(createAssignmentSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createAssignment(input, ctx.user.id, orgId);
    }),

  // 학습지 상세 조회 (검수자 이상)
  getAssignment: reviewerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getAssignmentById(input.id, orgId);
    }),

  // 학습지 목록 조회 (검수자 이상)
  listAssignments: reviewerProcedure
    .input(listAssignmentsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listAssignments(input, orgId);
    }),

  // 학습지 문항 업데이트 (검수자 이상)
  updateAssignmentItems: reviewerProcedure
    .input(updateAssignmentItemsSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateAssignmentItems(input, ctx.user.id, orgId);
    }),

  // 학습지 공개 (검수자 이상)
  publishAssignment: reviewerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return publishAssignment(input.id, ctx.user.id, orgId);
    }),

  // 학습지 내보내기 - PDF/링크 (검수자 이상)
  exportAssignment: reviewerProcedure
    .input(exportAssignmentSchema)
    .mutation(async ({ input }) => {
      const orgId = getOrgId();
      return exportAssignment(input, orgId);
    }),

  // ── Phase 10: 품질 대시보드 / 검수 큐 / 사용자 관리 / 감사 로그 ──

  // 품질 KPI 대시보드 (검수자 이상)
  getQualityMetrics: reviewerProcedure.query(async () => {
    const orgId = getOrgId();
    return getQualityMetrics(orgId);
  }),

  // 검수 작업 목록 (검수자 이상)
  listReviewTasks: reviewerProcedure
    .input(listReviewTasksSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listReviewTasks({ ...input, orgId });
    }),

  // 검수 작업 상태 변경 (검수자 이상)
  updateReviewTask: reviewerProcedure
    .input(updateReviewTaskSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateReviewTask(
        input.taskId,
        input.status,
        input.comment,
        ctx.user.id,
        orgId,
      );
    }),

  // 사용자 목록 조회 (관리자 전용)
  listUsers: adminProcedure
    .input(listUsersSchema)
    .query(async ({ input }) => {
      return listUsers(input);
    }),

  // 사용자 역할 변경 (관리자 전용)
  updateUserRole: adminProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateUserRole(input.userId, input.role, ctx.user.id, orgId);
    }),

  // 감사 로그 목록 조회 (관리자 전용)
  listAuditLogs: adminProcedure
    .input(listAuditLogsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listAuditLogs({ ...input, orgId });
    }),
});
