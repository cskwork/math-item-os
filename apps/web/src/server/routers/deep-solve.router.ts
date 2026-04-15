// Deep Solve tRPC 라우터 - 멀티에이전트 수학 풀이
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { deepSolve } from "../services/deep-solve.service";

export const deepSolveRouter = createTRPCRouter({
  solve: protectedProcedure
    .input(
      z.object({
        latex: z.string().min(1),
        schoolLevel: z.enum(["elementary", "middle", "high"]),
        showWork: z.boolean().optional().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      return deepSolve(input.latex, input.schoolLevel, input.showWork);
    }),
});
