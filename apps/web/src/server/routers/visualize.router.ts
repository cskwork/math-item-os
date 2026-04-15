// 시각화 tRPC 라우터 - protectedProcedure (인증 필수)
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { visualizeLatex } from "../services/visualize.service";

export const visualizeRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(
      z.object({
        latex: z.string().min(1),
        visualizationType: z.enum(["svg", "chartjs"]),
        context: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return visualizeLatex(
        input.latex,
        input.visualizationType,
        input.context,
      );
    }),
});
