// 애니메이션 tRPC 라우터 - LaTeX → Manim 코드 생성
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { animateLatex } from "../services/animate.service";

export const animateRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(
      z.object({
        latex: z.string().min(1),
        animationStyle: z.enum(["step_by_step", "transform", "graph"]),
        durationHint: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return animateLatex(
        input.latex,
        input.animationStyle,
        input.durationHint,
      );
    }),
});
