// tRPC v11 서버 설정 - context, middleware, procedure 정의
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "./auth";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";
import { requireRole } from "./middleware/rbac";

// Context 타입 정의
export async function createTRPCContext() {
  const session = await auth();

  return {
    prisma,
    session,
    user: session?.user ?? null,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// tRPC 초기화
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// 라우터/프로시저 빌더 export
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// 공개 프로시저 (인증 불필요)
export const publicProcedure = t.procedure;

// 인증 미들웨어 - 세션 필수
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "로그인이 필요합니다",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

// 인증된 프로시저
export const protectedProcedure = t.procedure.use(enforceAuth);

// 역할 기반 프로시저 팩토리
function withRoles(roles: readonly UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다",
      });
    }
    requireRole(ctx.session.user.role, roles);
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
      },
    });
  });
}

// 관리자 전용 프로시저
export const adminProcedure = t.procedure.use(
  withRoles(["admin"]),
);

// 검수자 이상 프로시저
export const reviewerProcedure = t.procedure.use(
  withRoles(["admin", "reviewer"]),
);
