// 스킬 CRUD + 선수 학습 관계 + 오개념 + 교정 경로 tRPC 라우터
// 모든 비즈니스 로직은 서비스 레이어에 위임
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  reviewerProcedure,
} from "../trpc";
import {
  createSkillSchema,
  createPrerequisiteSchema,
  getPrerequisiteGraphSchema,
  listSkillsSchema,
  getSkillItemsSchema,
  getByIdSchema,
  createMisconceptionSchema,
  listMisconceptionsSchema,
  getRemediationPathSchema,
} from "@math-item-os/shared/validators/index";
import {
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillById,
  listSkills,
  getSkillItems,
} from "../services/skill.service";
import {
  createPrerequisiteEdge,
  deletePrerequisiteEdge,
  getPrerequisiteGraph,
} from "../services/prerequisite.service";
import {
  createMisconception,
  updateMisconception,
  deleteMisconception,
  getMisconceptionById,
  listMisconceptions,
} from "../services/misconception.service";
import { getRemediationPath } from "../services/remediation.service";
import { getOrgId } from "../config/org-context";

// -- 인라인 스키마 정의 (공유 validators에 없는 것들) --

/** 스킬 수정 스키마 */
const updateSkillSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  topicPath: z.string().min(1).optional(),
  bloomLevel: z.number().int().min(1).max(6).optional(),
  estimatedTimeMin: z.number().int().min(1).optional(),
  typeLevel: z.number().int().min(1).max(6).optional(),
});

/** 오개념 수정 스키마 */
const updateMisconceptionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  typicalError: z.string().optional(),
  remediation: z.string().optional(),
  severity: z.number().int().min(1).max(5).optional(),
  relatedSkillIds: z.array(z.string()).optional(),
});

/** 선수 학습 관계 삭제 스키마 */
const deleteEdgeSchema = z.object({ edgeId: z.string() });

/** sortBy 값을 서비스 레이어 타입으로 매핑한다. */
function mapSortBy(
  sortBy: "difficulty" | "createdAt" | undefined,
): "difficultyAuthor" | "createdAt" | undefined {
  if (sortBy === "difficulty") return "difficultyAuthor";
  return sortBy;
}

export const skillRouter = createTRPCRouter({
  // 스킬 생성 (검수자 이상)
  create: reviewerProcedure
    .input(createSkillSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createSkill(input, ctx.user.id, orgId);
    }),

  // 스킬 수정 (검수자 이상)
  update: reviewerProcedure
    .input(updateSkillSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateSkill(input, ctx.user.id, orgId);
    }),

  // 스킬 삭제 (검수자 이상)
  delete: reviewerProcedure
    .input(getByIdSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return deleteSkill(input.id, ctx.user.id, orgId);
    }),

  // 스킬 단건 조회 (인증된 사용자)
  getById: protectedProcedure
    .input(getByIdSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getSkillById(input.id, orgId);
    }),

  // 스킬 목록 조회 (인증된 사용자)
  list: protectedProcedure
    .input(listSkillsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listSkills(input, orgId);
    }),

  // 스킬별 문항 목록 조회 (인증된 사용자)
  getItems: protectedProcedure
    .input(getSkillItemsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getSkillItems(
        { ...input, sortBy: mapSortBy(input.sortBy) },
        orgId,
      );
    }),

  // 선수 학습 관계 생성 (검수자 이상)
  createPrerequisite: reviewerProcedure
    .input(createPrerequisiteSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createPrerequisiteEdge(input, ctx.user.id, orgId);
    }),

  // 선수 학습 관계 삭제 (검수자 이상)
  deletePrerequisite: reviewerProcedure
    .input(deleteEdgeSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return deletePrerequisiteEdge(input.edgeId, ctx.user.id, orgId);
    }),

  // 선수 학습 그래프 조회 (인증된 사용자)
  getPrerequisiteGraph: protectedProcedure
    .input(getPrerequisiteGraphSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getPrerequisiteGraph(input, orgId);
    }),

  // 오개념 목록 조회 (인증된 사용자)
  listMisconceptions: protectedProcedure
    .input(listMisconceptionsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listMisconceptions(input, orgId);
    }),

  // 오개념 생성 (검수자 이상)
  createMisconception: reviewerProcedure
    .input(createMisconceptionSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createMisconception(input, ctx.user.id, orgId);
    }),

  // 오개념 단건 조회 (인증된 사용자)
  getMisconception: protectedProcedure
    .input(getByIdSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getMisconceptionById(input.id, orgId);
    }),

  // 오개념 수정 (검수자 이상)
  updateMisconception: reviewerProcedure
    .input(updateMisconceptionSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateMisconception(input, ctx.user.id, orgId);
    }),

  // 오개념 삭제 (검수자 이상)
  deleteMisconception: reviewerProcedure
    .input(getByIdSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return deleteMisconception(input.id, ctx.user.id, orgId);
    }),

  // 교정 학습 경로 조회 (인증된 사용자)
  getRemediationPath: protectedProcedure
    .input(getRemediationPathSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getRemediationPath(input, orgId);
    }),
});
