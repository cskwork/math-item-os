// pdf.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Prisma 모킹
// ─────────────────────────────────────────────

vi.mock("@math-item-os/db", () => ({
  prisma: {
    assignment: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@math-item-os/db";
import { TRPCError } from "@trpc/server";
import {
  exportAssignment,
  buildAssignmentHtmlById,
  buildAssignmentHtml,
} from "../pdf.service";

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

const ORG_ID = "org-1";

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign-1",
    orgId: ORG_ID,
    title: "중간고사 대비 학습지",
    purpose: "pre_exam",
    isPublished: true,
    solveToken: "token-1",
    createdAt: new Date("2025-03-15"),
    items: [
      {
        position: 1,
        points: 5,
        item: {
          id: "item-1",
          bodyLatex: "x + 1 = 2",
          bodyHtml: "<p>x + 1 = 2</p>",
          difficultyAuthor: 3,
          itemType: "short_answer",
        },
      },
      {
        position: 2,
        points: null,
        item: {
          id: "item-2",
          bodyLatex: "\\frac{1}{2} + \\frac{1}{3}",
          bodyHtml: null,
          difficultyAuthor: 2,
          itemType: "short_answer",
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// exportAssignment
// ─────────────────────────────────────────────

describe("exportAssignment", () => {
  it("PDF 형식으로 내보내면 PDF URL과 만료일을 반환한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(makeAssignment() as never);

    const result = await exportAssignment(
      { assignmentId: "assign-1", format: "pdf" },
      ORG_ID,
    );

    expect(result.url).toBe("/api/assignments/assign-1/pdf");
    expect(result.expiresAt).toBeDefined();
  });

  it("link 형식으로 내보내면 공유 URL을 반환한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(makeAssignment() as never);

    const result = await exportAssignment(
      { assignmentId: "assign-1", format: "link" },
      ORG_ID,
    );

    expect(result.url).toContain("/assignments/assign-1/share");
  });

  it("미공개 학습지를 link로 내보내면 BAD_REQUEST를 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(
      makeAssignment({ isPublished: false }) as never,
    );

    await expect(
      exportAssignment({ assignmentId: "assign-1", format: "link" }, ORG_ID),
    ).rejects.toThrow(TRPCError);

    try {
      await exportAssignment({ assignmentId: "assign-1", format: "link" }, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("학습지를 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(
      exportAssignment({ assignmentId: "bad-id", format: "pdf" }, ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 학습지이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(
      makeAssignment({ orgId: "other-org" }) as never,
    );

    try {
      await exportAssignment({ assignmentId: "assign-1", format: "pdf" }, ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// buildAssignmentHtmlById
// ─────────────────────────────────────────────

describe("buildAssignmentHtmlById", () => {
  it("학습지 ID로 HTML을 생성한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(makeAssignment() as never);

    const html = await buildAssignmentHtmlById("assign-1", ORG_ID);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("중간고사 대비 학습지");
  });

  it("학습지를 찾을 수 없으면 NOT_FOUND를 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

    await expect(
      buildAssignmentHtmlById("bad-id", ORG_ID),
    ).rejects.toThrow(TRPCError);
  });

  it("다른 조직의 학습지이면 FORBIDDEN을 throw한다", async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(
      makeAssignment({ orgId: "other-org" }) as never,
    );

    try {
      await buildAssignmentHtmlById("assign-1", ORG_ID);
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

// ─────────────────────────────────────────────
// buildAssignmentHtml
// ─────────────────────────────────────────────

describe("buildAssignmentHtml", () => {
  it("올바른 HTML 구조를 생성한다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"ko\">");
    expect(html).toContain("중간고사 대비 학습지");
    expect(html).toContain("시험대비"); // purpose label
    expect(html).toContain("2025년 03월 15일"); // date
  });

  it("bodyHtml이 있으면 직접 사용한다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("<p>x + 1 = 2</p>");
  });

  it("bodyHtml이 없으면 LaTeX를 katex-display span으로 감싼다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    // item-2의 bodyHtml이 null이므로 LaTeX를 katex-display로 감쌈
    expect(html).toContain("katex-display");
  });

  it("배점이 있으면 points-badge를 렌더한다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("5점");
    expect(html).toContain("points-badge");
  });

  it("배점이 null이면 points-badge를 렌더하지 않는다", () => {
    const assignment = makeAssignment({
      items: [
        {
          position: 1,
          points: null,
          item: {
            id: "item-1",
            bodyLatex: "test",
            bodyHtml: "<p>test</p>",
            difficultyAuthor: 3,
            itemType: "short_answer",
          },
        },
      ],
    });
    const html = buildAssignmentHtml(assignment as never);

    // li 태그 내 points-badge 없음을 간접 확인
    const itemSection = html.split('<li class="item"')[1];
    expect(itemSection).not.toContain("points-badge");
  });

  it("HTML 특수 문자를 이스케이프한다", () => {
    const assignment = makeAssignment({ title: '<script>alert("xss")</script>' });
    const html = buildAssignmentHtml(assignment as never);

    // 제목과 헤더에서는 이스케이프되어야 함
    expect(html).toContain("&lt;script&gt;");
    // <title> 태그에서도 이스케이프
    expect(html).toContain("<title>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</title>");
    // 인쇄 스크립트는 항상 존재하므로 h1 헤더에서 script가 이스케이프되었는지 확인
    expect(html).not.toMatch(/<h1>.*<script>.*<\/script>.*<\/h1>/);
  });

  it("인쇄용 CSS를 포함한다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("@media print");
    expect(html).toContain("@page");
    expect(html).toContain("page-break-inside: avoid");
  });

  it("KaTeX CSS 링크를 포함한다", () => {
    const assignment = makeAssignment();
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("katex@0.16.11/dist/katex.min.css");
  });

  it("알 수 없는 purpose는 원본 값을 그대로 사용한다", () => {
    const assignment = makeAssignment({ purpose: "custom_purpose" });
    const html = buildAssignmentHtml(assignment as never);

    expect(html).toContain("custom_purpose");
  });
});
