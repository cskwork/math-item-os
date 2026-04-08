// 성과 분석 tRPC 라우터 - 교사 인증 필요
// 과제 통계, typeLevel 분석, 취약 유형, 학생 프로필, 트렌드
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  assignmentOverviewSchema,
  typeLevelBreakdownSchema,
  weakTypesSchema,
  studentProfileSchema,
  trendsSchema,
} from "@math-item-os/shared/validators/index";
import * as analyticsService from "../services/analytics.service";

// MVP 단계에서 사용할 기본 조직 ID
const DEFAULT_ORG_ID = "default-org";

/** 사용자의 조직 ID를 반환한다. MVP에서는 고정값 사용. */
function getOrgId(): string {
  return DEFAULT_ORG_ID;
}

export const analyticsRouter = createTRPCRouter({
  // 과제 전체 통계 (세션 수, 평균/중앙값/최저/최고 점수, typeLevel별 분석)
  assignmentOverview: protectedProcedure
    .input(assignmentOverviewSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return analyticsService.getAssignmentAnalytics(
        input.assignmentId,
        orgId,
      );
    }),

  // typeLevel별 정답률 분석
  typeLevelBreakdown: protectedProcedure
    .input(typeLevelBreakdownSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return analyticsService.getTypeLevelAnalytics(
        input.assignmentId,
        orgId,
      );
    }),

  // 취약 유형 추출 (정답률 < threshold)
  weakTypes: protectedProcedure
    .input(weakTypesSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return analyticsService.getWeakTypes(
        input.assignmentId,
        orgId,
        input.threshold,
      );
    }),

  // 개별 학생 약점 프로필
  studentProfile: protectedProcedure
    .input(studentProfileSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return analyticsService.getStudentWeaknessProfile(
        input.sessionId,
        orgId,
      );
    }),

  // 다수 과제 트렌드 비교
  trends: protectedProcedure
    .input(trendsSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      return analyticsService.getAssignmentTrends(
        input.assignmentIds,
        orgId,
      );
    }),
});
