// error-worksheet.service 단위 테스트 — Prisma + similarity 모킹
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// -------------------------------------------------
// Mocks
// -------------------------------------------------

vi.mock("@math-item-os/db", () => ({
  prisma: {
    studentSession: { findUnique: vi.fn() },
  },
}));

vi.mock("../similarity.service", () => ({
  findSimilarItems: vi.fn(),
}));

import { prisma } from "@math-item-os/db";
import { findSimilarItems } from "../similarity.service";
import { generateErrorWorksheet } from "../error-worksheet.service";

const ORG = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------
// helper: 세션 팩토리
// -------------------------------------------------

function makeSession(overrides: {
  id?: string;
  status?: string;
  assignmentOrgId?: string;
  responses?: Array<{
    studentAnswer: unknown;
    result: string;
    item: {
      id: string;
      bodyLatex?: string;
      bodyHtml?: string | null;
      choices?: unknown;
      answer?: unknown;
      itemType?: string;
      answerFormat?: string;
      misconceptions?: Array<{
        misconception: {
          id: string;
          code: string;
          title: string;
          typicalError: string | null;
          remediation: string | null;
          severity: number;
        };
      }>;
    };
  }>;
}) {
  return {
    id: overrides.id ?? "session-1",
    status: overrides.status ?? "graded",
    assignmentId: "asgn-1",
    assignment: { orgId: overrides.assignmentOrgId ?? ORG },
    responses: (overrides.responses ?? []).map((r) => ({
      studentAnswer: r.studentAnswer,
      result: r.result,
      assignmentItem: {
        item: {
          id: r.item.id,
          bodyLatex: r.item.bodyLatex ?? "x=1",
          bodyHtml: r.item.bodyHtml ?? null,
          choices: r.item.choices ?? null,
          answer: r.item.answer ?? { value: "1" },
          itemType: r.item.itemType ?? "short_answer",
          answerFormat: r.item.answerFormat ?? "exact_value",
          misconceptions: r.item.misconceptions ?? [],
        },
      },
    })),
  };
}

// -------------------------------------------------
// generateErrorWorksheet
// -------------------------------------------------

describe("generateErrorWorksheet", () => {
  it("세션이 존재하지 않으면 NOT_FOUND", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(null);

    await expect(
      generateErrorWorksheet("bad-session", ORG),
    ).rejects.toThrow(TRPCError);
  });

  it("채점 전 세션이면 BAD_REQUEST", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({ status: "in_progress" }) as never,
    );

    await expect(
      generateErrorWorksheet("session-1", ORG),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직이면 FORBIDDEN", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({ assignmentOrgId: "other-org" }) as never,
    );

    await expect(
      generateErrorWorksheet("session-1", ORG),
    ).rejects.toThrow(TRPCError);
  });

  it("오답이 없으면 빈 배열을 반환한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({ responses: [] }) as never,
    );

    const result = await generateErrorWorksheet("session-1", ORG);
    expect(result).toEqual([]);
  });

  it("오답에 대해 유사 문항과 오개념을 포함한 워크시트를 반환한다", async () => {
    const misconception = {
      id: "mc-1",
      code: "MC001",
      title: "부호 오류",
      typicalError: "음수 부호 누락",
      remediation: "부호 규칙 복습",
      severity: 3,
    };

    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({
        responses: [
          {
            studentAnswer: { value: "2" },
            result: "incorrect",
            item: {
              id: "item-1",
              misconceptions: [{ misconception }],
            },
          },
        ],
      }) as never,
    );

    vi.mocked(findSimilarItems).mockResolvedValue([
      { itemId: "twin-1", score: 0.9, explanation: "유사 문항" },
    ] as never);

    const result = await generateErrorWorksheet("session-1", ORG);

    expect(result).toHaveLength(1);
    expect(result[0]!.originalItemId).toBe("item-1");
    expect(result[0]!.misconceptions).toHaveLength(1);
    expect(result[0]!.misconceptions[0]!.code).toBe("MC001");
    expect(result[0]!.twinProblems).toHaveLength(1);
    expect(result[0]!.twinProblems[0]!.itemId).toBe("twin-1");
  });

  it("여러 오답을 처리한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({
        responses: [
          {
            studentAnswer: { value: "wrong1" },
            result: "incorrect",
            item: { id: "item-1" },
          },
          {
            studentAnswer: { value: "partial" },
            result: "partial",
            item: { id: "item-2" },
          },
        ],
      }) as never,
    );

    vi.mocked(findSimilarItems).mockResolvedValue([]);

    const result = await generateErrorWorksheet("session-1", ORG);

    expect(result).toHaveLength(2);
    expect(result[0]!.result).toBe("incorrect");
    expect(result[1]!.result).toBe("partial");
  });

  it("findSimilarItems에 올바른 파라미터를 전달한다", async () => {
    vi.mocked(prisma.studentSession.findUnique).mockResolvedValue(
      makeSession({
        responses: [
          {
            studentAnswer: { value: "x" },
            result: "incorrect",
            item: { id: "item-99" },
          },
        ],
      }) as never,
    );

    vi.mocked(findSimilarItems).mockResolvedValue([]);

    await generateErrorWorksheet("session-1", ORG);

    expect(findSimilarItems).toHaveBeenCalledWith("item-99", ORG, 3);
  });
});
