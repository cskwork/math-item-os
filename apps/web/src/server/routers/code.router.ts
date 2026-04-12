// 코드 실행 tRPC 라우터
import { z } from "zod";
import { createTRPCRouter, reviewerProcedure, protectedProcedure } from "../trpc";
import { executeCode, getSupportedLanguages } from "../services/code-execution.service";

const executeCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.enum(["C", "JAVA", "PYTHON", "SQL"]),
  stdin: z.string().max(10000).optional(),
});

export const codeRouter = createTRPCRouter({
  /** 코드 실행 — reviewer 이상 권한 필요 */
  execute: reviewerProcedure
    .input(executeCodeSchema)
    .mutation(async ({ input }) => {
      return executeCode(input.code, input.language, input.stdin);
    }),

  /** 지원 언어 목록 조회 */
  supportedLanguages: protectedProcedure.query(() => {
    return getSupportedLanguages();
  }),
});
