// 오답 워크시트 tRPC 라우터 - 교사 인증 필요
// 오답 워크시트 생성, 세션 목록 조회
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  generateWorksheetSchema,
  listSessionsSchema,
} from "@math-item-os/shared/validators/index";
import { generateErrorWorksheet } from "../services/error-worksheet.service";
import { prisma } from "@math-item-os/db";

// MVP 단계에서 사용할 기본 조직 ID
const DEFAULT_ORG_ID = "default-org";

/** 사용자의 조직 ID를 반환한다. MVP에서는 고정값 사용. */
function getOrgId(): string {
  return DEFAULT_ORG_ID;
}

export const worksheetRouter = createTRPCRouter({
  // 오답 워크시트 생성 (교사 인증 필요)
  generate: protectedProcedure
    .input(generateWorksheetSchema)
    .query(async ({ input }) => {
      const orgId = getOrgId();
      const worksheetItems = await generateErrorWorksheet(
        input.sessionId,
        orgId,
      );
      return { items: worksheetItems };
    }),

  // 세션 목록 조회 (교사 인증 필요, 페이지네이션)
  listSessions: protectedProcedure
    .input(listSessionsSchema)
    .query(async ({ input }) => {
      const { assignmentId, status, page, limit } = input;

      const where = {
        assignmentId,
        ...(status != null && { status }),
      };

      const [sessions, total] = await Promise.all([
        prisma.studentSession.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            studentName: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            gradedAt: true,
            totalScore: true,
            maxScore: true,
          },
        }),
        prisma.studentSession.count({ where }),
      ]);

      return { sessions, total, page, limit };
    }),
});
