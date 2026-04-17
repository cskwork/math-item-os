// pdf.service 단위 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// math-parser 모킹 (renderLatex 호출 횟수 측정)
// ─────────────────────────────────────────────
const { mockRenderLatex } = vi.hoisted(() => ({
  mockRenderLatex: vi.fn(),
}));

vi.mock("@math-item-os/math-parser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@math-item-os/math-parser")>();
  return {
    ...actual,
    renderLatex: mockRenderLatex,
  };
});

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
  mockRenderLatex.mockImplementation(
    (latex: string, opts?: { displayMode?: boolean }) => ({
      html: `<span class="${opts?.displayMode ? "katex-display" : "katex"}">${latex}</span>`,
      errors: [],
    }),
  );
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

  it("혼합 본문의 $$...$$ 블록을 display 모드로 렌더링한다", () => {
    // 회귀 방지: `[\s\S]` 대신 `[\s\\S]`로 되면 $$...$$ 매칭이 깨지고
    // 내부가 inline으로 잘못 렌더되면서 바깥쪽 `$`가 텍스트로 유출된다.
    const assignment = makeAssignment({
      items: [
        {
          position: 1,
          points: null,
          item: {
            id: "item-display",
            bodyLatex: "다음 값을 구하시오: $$x + 1$$",
            bodyHtml: null,
            difficultyAuthor: 2,
            itemType: "short_answer",
          },
        },
      ],
    });

    const html = buildAssignmentHtml(assignment as never);
    const itemSection = html.split('<li class="item"')[1] ?? "";

    expect(itemSection).toContain("katex-display");
    // 바깥 `$` 또는 이스케이프된 `$` 텍스트가 남으면 안 된다.
    expect(itemSection).not.toMatch(/\$\$/);
    expect(itemSection).not.toContain("&#36;");
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

// ─────────────────────────────────────────────
// renderLatex 메모이제이션 (성능 최적화)
// ─────────────────────────────────────────────

describe("renderMixedLatex memoization", () => {
  function makeMemoAssignment(items: ReadonlyArray<{ bodyLatex: string }>) {
    return makeAssignment({
      items: items.map((it, idx) => ({
        position: idx + 1,
        points: null,
        item: {
          id: `item-${idx}`,
          bodyLatex: it.bodyLatex,
          bodyHtml: null,
          difficultyAuthor: 2,
          itemType: "short_answer",
        },
      })),
    });
  }

  it("동일한 (latex, displayMode) 조합은 한 번만 renderLatex를 호출한다", () => {
    const assignment = makeMemoAssignment([
      { bodyLatex: "$x+1$ 또는 $x+1$의 값" },
      { bodyLatex: "답이 $x+1$일 때 $\\frac{1}{2}$는?" },
    ]);

    buildAssignmentHtml(assignment as never);
    buildAssignmentHtml(assignment as never);

    const uniqueKeys = new Set(
      mockRenderLatex.mock.calls.map(
        (c) => `${(c[1] as { displayMode?: boolean } | undefined)?.displayMode ? "D" : "I"}|${c[0] as string}`,
      ),
    );

    expect(mockRenderLatex).toHaveBeenCalledTimes(uniqueKeys.size);
    expect(uniqueKeys.has("I|x+1")).toBe(true);
    expect(uniqueKeys.has("I|\\frac{1}{2}")).toBe(true);
  });

  it("displayMode가 다르면 별도로 캐싱한다", () => {
    // 각 테스트가 서로 독립적이도록 고유 latex 사용 (캐시는 모듈 수명)
    const latex = "y-2";
    const assignment = makeMemoAssignment([
      { bodyLatex: `$${latex}$` },
      { bodyLatex: `$$${latex}$$` },
      { bodyLatex: `$${latex}$` },
      { bodyLatex: `$$${latex}$$` },
    ]);

    buildAssignmentHtml(assignment as never);

    const inline = mockRenderLatex.mock.calls.filter(
      (c) => !(c[1] as { displayMode?: boolean } | undefined)?.displayMode && c[0] === latex,
    );
    const display = mockRenderLatex.mock.calls.filter(
      (c) => (c[1] as { displayMode?: boolean } | undefined)?.displayMode && c[0] === latex,
    );

    expect(inline).toHaveLength(1);
    expect(display).toHaveLength(1);
  });
});
