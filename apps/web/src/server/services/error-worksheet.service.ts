// 오답 워크시트 생성 서비스 - 오답 문항 수집, 유사 문항 추천, 오개념 매핑
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import { findSimilarItems } from "./similarity.service";

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

/** 오답 워크시트의 개별 항목 */
interface ErrorWorksheetEntry {
  readonly originalItemId: string;
  readonly originalItem: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly bodyHtml: string | null;
    readonly choices: unknown;
    readonly answer: unknown;
    readonly itemType: string;
  };
  readonly studentAnswer: unknown;
  readonly correctAnswer: unknown;
  readonly result: string;
  readonly misconceptions: ReadonlyArray<{
    readonly id: string;
    readonly code: string;
    readonly title: string;
    readonly typicalError: string | null;
    readonly remediation: string | null;
    readonly severity: number;
  }>;
  readonly twinProblems: ReadonlyArray<{
    readonly itemId: string;
    readonly score: number;
    readonly explanation: string;
  }>;
}

// -------------------------------------------------
// 상수
// -------------------------------------------------

/** 유사 문항 추천 개수 */
const SIMILAR_ITEMS_LIMIT = 3;

// -------------------------------------------------
// 1. 오답 워크시트 생성
// -------------------------------------------------

/**
 * 세션의 오답/부분정답 문항을 수집하여 워크시트를 생성한다.
 * 각 오답 문항에 대해 유사 문항 추천 + 오개념 매핑을 수행한다.
 */
export async function generateErrorWorksheet(
  sessionId: string,
  orgId: string,
): Promise<ReadonlyArray<ErrorWorksheetEntry>> {
  // 세션 + 오답 응답 조회
  const session = await prisma.studentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      assignmentId: true,
      assignment: {
        select: { orgId: true },
      },
      responses: {
        where: {
          result: { in: ["incorrect", "partial"] },
        },
        include: {
          assignmentItem: {
            include: {
              item: {
                select: {
                  id: true,
                  bodyLatex: true,
                  bodyHtml: true,
                  choices: true,
                  answer: true,
                  itemType: true,
                  misconceptions: {
                    include: {
                      misconception: {
                        select: {
                          id: true,
                          code: true,
                          title: true,
                          typicalError: true,
                          remediation: true,
                          severity: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `풀이 세션을 찾을 수 없습니다: ${sessionId}`,
    });
  }

  if (session.status !== "graded") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "채점이 완료된 세션에서만 오답 워크시트를 생성할 수 있습니다",
    });
  }

  // 조직 ID 검증 (보호된 라우터에서 호출 시 orgId가 일치해야 함)
  const assignmentOrgId = session.assignment.orgId;
  if (assignmentOrgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 세션이 아닙니다",
    });
  }

  // 오답 응답이 없으면 빈 배열 반환
  if (session.responses.length === 0) {
    return [];
  }

  // 각 오답에 대해 유사 문항 + 오개념 매핑
  const worksheetEntries = await Promise.all(
    session.responses.map(async (response: (typeof session.responses)[number]) => {
      const item = response.assignmentItem.item;

      // 유사 문항 검색
      const similarItems = await findSimilarItems(
        item.id,
        orgId,
        SIMILAR_ITEMS_LIMIT,
      );

      // 오개념 매핑
      const misconceptions = item.misconceptions.map(
        (im: (typeof item.misconceptions)[number]) => im.misconception,
      );

      const entry: ErrorWorksheetEntry = {
        originalItemId: item.id,
        originalItem: {
          id: item.id,
          bodyLatex: item.bodyLatex,
          bodyHtml: item.bodyHtml,
          choices: item.choices,
          answer: item.answer,
          itemType: item.itemType,
        },
        studentAnswer: response.studentAnswer,
        correctAnswer: item.answer,
        result: response.result,
        misconceptions,
        twinProblems: similarItems.map((si) => ({
          itemId: si.itemId,
          score: si.score,
          explanation: si.explanation,
        })),
      };

      return entry;
    }),
  );

  return worksheetEntries;
}
