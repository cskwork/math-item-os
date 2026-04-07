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
} from "@math-item-os/shared/validators/index";
import {
  createItem,
  updateItem,
  getItemById,
  listItems,
} from "../services/item.service";
import { transitionStatus } from "../services/quality-status.service";

// MVP 단계에서 사용할 기본 조직 ID
const DEFAULT_ORG_ID = "default-org";

/** 사용자의 조직 ID를 반환한다. MVP에서는 고정값 사용. */
function getOrgId(): string {
  return DEFAULT_ORG_ID;
}

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
});
