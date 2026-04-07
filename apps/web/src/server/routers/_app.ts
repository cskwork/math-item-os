// 루트 앱 라우터 - 모든 도메인 라우터 통합
import { createTRPCRouter } from "../trpc";

// Phase 3+ 에서 도메인 라우터 추가 시 여기에 import
// import { itemRouter } from "./item.router";
// import { searchRouter } from "./search.router";
// import { skillRouter } from "./skill.router";
// import { adminRouter } from "./admin.router";

export const appRouter = createTRPCRouter({
  // Phase 3+ 에서 활성화
  // item: itemRouter,
  // search: searchRouter,
  // skill: skillRouter,
  // admin: adminRouter,
});

export type AppRouter = typeof appRouter;
