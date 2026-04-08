// 루트 앱 라우터 - 모든 도메인 라우터 통합
import { createTRPCRouter } from "../trpc";
import { itemRouter } from "./item.router";
import { searchRouter } from "./search.router";
import { skillRouter } from "./skill.router";
import { adminRouter } from "./admin.router";
import { solveRouter } from "./solve.router";
import { worksheetRouter } from "./worksheet.router";
import { analyticsRouter } from "./analytics.router";

export const appRouter = createTRPCRouter({
  item: itemRouter,
  search: searchRouter,
  skill: skillRouter,
  admin: adminRouter,
  solve: solveRouter,
  worksheet: worksheetRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
