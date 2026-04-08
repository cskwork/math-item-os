// 관리자 tRPC 라우터 - 템플릿 CRUD + 변형 문항 생성 + 생성 결과 조회
// 모든 비즈니스 로직은 서비스 레이어에 위임
import { z } from "zod";
import { createTRPCRouter, reviewerProcedure } from "../trpc";
import {
  listTemplatesSchema,
  generateVariantsSchema,
  getGenerationResultSchema,
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
});
