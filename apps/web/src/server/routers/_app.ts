// 루트 앱 라우터 - 모든 도메인 라우터 통합
import { createTRPCRouter } from "../trpc";
import { itemRouter } from "./item.router";
import { searchRouter } from "./search.router";

// Phase 5+ 에서 도메인 라우터 추가 시 여기에 import
// import { skillRouter } from "./skill.router";
// import { adminRouter } from "./admin.router";

export const appRouter = createTRPCRouter({
  item: itemRouter,
  search: searchRouter,
  // Phase 5+ 에서 활성화
  // skill: skillRouter,
  // admin: adminRouter,
});

export type AppRouter = typeof appRouter;
