// 수학 문항 CRUD tRPC 라우터
// 모든 비즈니스 로직은 서비스 레이어에 위임
import {
  createTRPCRouter,
  protectedProcedure,
  reviewerProcedure,
} from "../trpc";
import {
  createItemSchema,
  updateItemSchema,
  updateStatusSchema,
  getByIdSchema,
  listItemsSchema,
  bulkUploadSchema,
  getBulkUploadStatusSchema,
  suggestMetadataSchema,
  getReviewSuggestionsSchema,
  exportQtiSchema,
} from "@math-item-os/shared/validators/index";
import {
  createItem,
  updateItem,
  getItemById,
  listItems,
} from "../services/item.service";
import { transitionStatus } from "../services/quality-status.service";
import {
  startBulkUpload,
  getBulkUploadJobStatus,
} from "../services/upload.service";
import { suggestMetadata } from "../services/metadata-suggest.service";
import { getReviewSuggestions } from "../services/auto-review.service";
import { exportItemToQti } from "../services/qti-export.service";
import { getOrgId } from "../config/org-context";

export const itemRouter = createTRPCRouter({
  // 문항 생성 (검수자 이상)
  create: reviewerProcedure
    .input(createItemSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return createItem(input, ctx.user.id, orgId);
    }),

  // 문항 수정 (검수자 이상)
  update: reviewerProcedure
    .input(updateItemSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return updateItem(input, ctx.user.id, orgId);
    }),

  // 문항 상태 전이 (인증된 사용자)
  updateStatus: protectedProcedure
    .input(updateStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      const item = await transitionStatus({
        itemId: input.id,
        newStatus: input.status,
        userRole: ctx.user.role,
        userId: ctx.user.id,
        orgId,
      });
      return { item };
    }),

  // 문항 단건 조회 (인증된 사용자)
  getById: protectedProcedure
    .input(getByIdSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getItemById(input.id, orgId);
    }),

  // 문항 목록 조회 (인증된 사용자)
  list: protectedProcedure
    .input(listItemsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return listItems(input, orgId);
    }),

  // 메타데이터 자동 태깅 추천 (인증된 사용자)
  suggestMetadata: protectedProcedure
    .input(suggestMetadataSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return suggestMetadata(input, orgId);
    }),

  // 검토 제안 조회 (인증된 사용자)
  getReviewSuggestions: protectedProcedure
    .input(getReviewSuggestionsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return getReviewSuggestions(input.itemId, orgId);
    }),

  // 대량 업로드 시작 (검수자 이상)
  bulkUpload: reviewerProcedure
    .input(bulkUploadSchema)
    .mutation(async ({ input, ctx }) => {
      const orgId = getOrgId();
      return startBulkUpload(input, ctx.user.id, orgId);
    }),

  // 대량 업로드 상태 조회 (검수자 이상)
  getBulkUploadStatus: reviewerProcedure
    .input(getBulkUploadStatusSchema)
    .query(async ({ input }) => {
      return getBulkUploadJobStatus(input.jobId);
    }),

  // QTI 3.0 단건 내보내기 (인증된 사용자)
  exportQti: protectedProcedure
    .input(exportQtiSchema)
    .mutation(async ({ input }) => {
      const orgId = getOrgId();
      return exportItemToQti(input.itemId, orgId);
    }),
});
