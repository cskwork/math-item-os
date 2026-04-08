// tRPC v11 서버 설정 - context, middleware, procedure 정의
// Phase 10: input sanitization 미들웨어 추가
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "./auth";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";
import { requireRole } from "./middleware/rbac";
import { sanitizeInput } from "./middleware/sanitize";

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

// tRPC 초기화 (SSE subscription 지원)
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
  sse: {
    ping: { enabled: true, intervalMs: 3000 },
    client: { reconnectAfterInactivityMs: 10000 },
  },
});

// 라우터/프로시저 빌더 export
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// 입력 정제 미들웨어 - 모든 문자열 입력에서 제어 문자 제거
const sanitizeMiddleware = t.middleware(async ({ getRawInput, next }) => {
  const rawInput = await getRawInput();

  if (rawInput != null && typeof rawInput === "object") {
    return next({
      getRawInput: async () => sanitizeInput(rawInput),
    });
  }

  return next();
});

// 공개 프로시저 (인증 불필요, 입력 정제 적용)
export const publicProcedure = t.procedure.use(sanitizeMiddleware);

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

// 인증된 프로시저 (입력 정제 + 인증)
export const protectedProcedure = t.procedure
  .use(sanitizeMiddleware)
  .use(enforceAuth);

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

// 관리자 전용 프로시저 (입력 정제 + 역할 검증)
export const adminProcedure = t.procedure
  .use(sanitizeMiddleware)
  .use(withRoles(["admin"]));

// 검수자 이상 프로시저 (입력 정제 + 역할 검증)
export const reviewerProcedure = t.procedure
  .use(sanitizeMiddleware)
  .use(withRoles(["admin", "reviewer"]));
