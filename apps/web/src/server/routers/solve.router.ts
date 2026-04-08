// 학생 풀이 tRPC 라우터 - 공개 프로시저 (인증 불필요)
// 토큰 기반으로 과제 접근, 세션 관리, 응답 제출, 결과 조회
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  getSolveAssignmentSchema,
  startSessionSchema,
  submitResponseSchema,
  submitSessionSchema,
  getResultsSchema,
} from "@math-item-os/shared/validators/index";
import {
  getAssignmentBySolveToken,
  createStudentSession,
  submitStudentResponse,
  submitSession,
  getSessionByToken,
} from "../services/student-session.service";

export const solveRouter = createTRPCRouter({
  // 과제 조회 (토큰 기반, 인증 불필요)
  getAssignment: publicProcedure
    .input(getSolveAssignmentSchema)
    .query(async ({ input }) => {
      return getAssignmentBySolveToken(input.solveToken);
    }),

  // 풀이 세션 시작 (인증 불필요)
  startSession: publicProcedure
    .input(startSessionSchema)
    .mutation(async ({ input }) => {
      return createStudentSession(input);
    }),

  // 개별 문항 응답 제출 (인증 불필요)
  submitResponse: publicProcedure
    .input(submitResponseSchema)
    .mutation(async ({ input }) => {
      return submitStudentResponse(input);
    }),

  // 세션 전체 제출 + 채점 (인증 불필요)
  submitSession: publicProcedure
    .input(submitSessionSchema)
    .mutation(async ({ input }) => {
      return submitSession(input.sessionToken);
    }),

  // 채점 결과 조회 (인증 불필요)
  getResults: publicProcedure
    .input(getResultsSchema)
    .query(async ({ input }) => {
      return getSessionByToken(input.sessionToken);
    }),
});
