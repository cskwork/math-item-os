// 관리자 tRPC 라우터 - 템플릿 CRUD + 변형 문항 생성 + 생성 결과 조회 + 학습지 관리
// 모든 비즈니스 로직은 서비스 레이어에 위임
import { z } from "zod";
import { createTRPCRouter, reviewerProcedure } from "../trpc";
import {
  listTemplatesSchema,
  generateVariantsSchema,
  getGenerationResultSchema,
  createAssignmentSchema,
  exportAssignmentSchema,
  paginationSchema,
  assignmentPurposeSchema,
} from "@math-item-os/shared/validators/index";
import {
  listTemplates,
  getTemplateById,
  createTemplate,
} from "../services/template.service";
import {
  startGenerationJob,
  getGenerationResult,
} from "../services/generation.service";
import {
  createAssignment,
  getAssignmentById,
  listAssignments,
  updateAssignmentItems,
  publishAssignment,
} from "../services/assignment.service";
import { exportAssignment } from "../services/pdf.service";

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
  answerTemplate: z.string().min(1),
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
      return updateAssignmentItems(
        input.assignmentId,
        input.itemIds,
        input.points,
        ctx.user.id,
        orgId,
      );
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
      return exportAssignment(input.assignmentId, input.format, orgId);
    }),
});
