// PDF 생성 서비스 - 학습지/워크시트 내보내기, 인쇄용 HTML 빌드, 공유 링크 생성
import { TRPCError } from "@trpc/server";
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";
import { renderLatex } from "@math-item-os/math-parser";

// -------------------------------------------------
// 입력/출력 타입 정의
// -------------------------------------------------

export interface ExportAssignmentInput {
  readonly assignmentId: string;
  readonly format: "pdf" | "link";
}

export interface ExportResult {
  readonly url: string;
  readonly expiresAt?: Date;
}

// -------------------------------------------------
// 목적 라벨 (한국어)
// -------------------------------------------------

const PURPOSE_LABELS: Readonly<Record<string, string>> = {
  diagnosis: "진단평가",
  remediation: "보충학습",
  pre_exam: "시험대비",
  advanced: "심화학습",
};

// -------------------------------------------------
// 관계 포함 공통 include 정의
// -------------------------------------------------

/** 내보내기용 학습지 상세 조회 (문항 본문 + 배점 포함) */
const EXPORT_INCLUDE = {
  items: {
    include: {
      item: {
        select: {
          id: true,
          bodyLatex: true,
          bodyHtml: true,
          difficultyAuthor: true,
          itemType: true,
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.AssignmentInclude;

/** Prisma 조회 결과 타입 (내보내기용) */
type AssignmentWithItems = Prisma.AssignmentGetPayload<{
  include: typeof EXPORT_INCLUDE;
}>;

// -------------------------------------------------
// 1. 학습지 내보내기 (메인 진입점)
// -------------------------------------------------

/** 학습지를 PDF 또는 공유 링크로 내보낸다. */
export async function exportAssignment(
  input: ExportAssignmentInput,
  orgId: string,
): Promise<ExportResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: input.assignmentId },
    include: EXPORT_INCLUDE,
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${input.assignmentId}`,
    });
  }

  if (assignment.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  if (input.format === "pdf") {
    return generatePdf(assignment);
  }

  return generateShareLink(assignment);
}

// -------------------------------------------------
// 2. PDF 생성 (인쇄용 HTML 제공)
// -------------------------------------------------

/** 학습지 데이터로 인쇄용 HTML 엔드포인트 URL을 반환한다. */
function generatePdf(assignment: AssignmentWithItems): ExportResult {
  const EXPIRY_HOURS = 24;
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  return {
    url: `/api/assignments/${assignment.id}/pdf`,
    expiresAt,
  };
}

// -------------------------------------------------
// 3. 공유 링크 생성
// -------------------------------------------------

/** 공개된 학습지의 공유 URL을 생성한다. 미공개 시 에러 반환. */
function generateShareLink(assignment: AssignmentWithItems): ExportResult {
  if (!assignment.isPublished) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "공개되지 않은 학습지는 공유할 수 없습니다",
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    url: `${baseUrl}/assignments/${assignment.id}/share`,
  };
}

// -------------------------------------------------
// 4. 인쇄용 HTML 빌드
// -------------------------------------------------

/** 학습지 ID로 인쇄용 HTML 문서를 생성한다. */
export async function buildAssignmentHtmlById(
  assignmentId: string,
  orgId: string,
): Promise<string> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: EXPORT_INCLUDE,
  });

  if (!assignment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `학습지를 찾을 수 없습니다: ${assignmentId}`,
    });
  }

  if (assignment.orgId !== orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "해당 조직의 학습지가 아닙니다",
    });
  }

  return buildAssignmentHtml(assignment);
}

/** 학습지 데이터로 인쇄 최적화된 HTML 문서를 빌드한다. */
export function buildAssignmentHtml(
  assignment: AssignmentWithItems,
): string {
  const purposeLabel =
    PURPOSE_LABELS[assignment.purpose] ?? assignment.purpose;
  const dateStr = formatDate(assignment.createdAt);
  const itemsHtml = assignment.items
    .map((ai: AssignmentWithItems["items"][number], idx: number) =>
      buildItemHtml(ai, idx + 1),
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(assignment.title)}</title>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
    crossorigin="anonymous"
  />
${buildPrintStyles()}
</head>
<body>
  <header class="assignment-header">
    <h1>${escapeHtml(assignment.title)}</h1>
    <div class="assignment-meta">
      <span class="purpose-badge">${escapeHtml(purposeLabel)}</span>
      <span class="date">${escapeHtml(dateStr)}</span>
    </div>
  </header>

  <main class="assignment-items">
    <ol class="item-list">
${itemsHtml}
    </ol>
  </main>

  <footer class="assignment-footer">
    <span class="page-info"></span>
  </footer>

  <script>window.addEventListener("load",function(){window.print()});</script>
</body>
</html>`;
}

// -------------------------------------------------
// 내부 유틸리티
// -------------------------------------------------

/** 단일 문항의 HTML을 빌드한다. bodyHtml 우선, 없으면 bodyLatex를 KaTeX span으로 감싼다. */
function buildItemHtml(
  assignmentItem: AssignmentWithItems["items"][number],
  number: number,
): string {
  const { item, points } = assignmentItem;

  // bodyHtml 우선 사용, 없으면 $...$ 구간만 서버사이드 KaTeX 렌더링
  const content = item.bodyHtml
    ? item.bodyHtml
    : renderMixedLatex(item.bodyLatex);

  const pointsBadge =
    points != null
      ? `<span class="points-badge">${points}점</span>`
      : "";

  return `      <li class="item" value="${number}">
        <div class="item-content">${content}</div>
        ${pointsBadge}
      </li>`;
}

/** 인쇄 최적화 CSS를 반환한다. A4 레이아웃, 여백, 페이지 나눔 설정 포함. */
function buildPrintStyles(): string {
  return `  <style>
    /* 리셋 및 기본 */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 20mm;
    }

    /* 헤더 */
    .assignment-header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #333;
    }

    .assignment-header h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .assignment-meta {
      display: flex;
      justify-content: center;
      gap: 16px;
      font-size: 13px;
      color: #555;
    }

    .purpose-badge {
      background: #f0f0f0;
      padding: 2px 10px;
      border-radius: 4px;
      font-weight: 600;
    }

    /* 문항 목록 */
    .item-list {
      list-style: none;
      counter-reset: item-counter;
    }

    .item {
      counter-increment: item-counter;
      margin-bottom: 20px;
      padding: 12px 16px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .item::before {
      content: counter(item-counter) ".";
      font-weight: 700;
      font-size: 15px;
      margin-right: 8px;
    }

    .item-content {
      display: inline;
    }

    .points-badge {
      display: inline-block;
      margin-left: 12px;
      font-size: 12px;
      color: #666;
      background: #fafafa;
      padding: 1px 8px;
      border-radius: 3px;
      border: 1px solid #ddd;
    }

    /* 푸터 */
    .assignment-footer {
      margin-top: 32px;
      text-align: center;
      font-size: 11px;
      color: #999;
    }

    /* 인쇄 최적화 */
    @media print {
      body { padding: 15mm; }

      @page {
        size: A4;
        margin: 15mm;

        @bottom-center {
          content: counter(page) " / " counter(pages);
          font-size: 10px;
          color: #999;
        }
      }

      .assignment-header { page-break-after: avoid; }
      .item { page-break-inside: avoid; }
    }
  </style>`;
}

/**
 * 한국어+LaTeX 혼합 텍스트에서 $...$ 구간만 KaTeX로 렌더링한다.
 * $ 구분자가 없으면 전체를 display 모드 KaTeX로 렌더링한다.
 * 예: "$(-5) \\times (-4)$의 값을 구하시오." → <렌더링된 수식>의 값을 구하시오.
 */
function renderMixedLatex(text: string): string {
  const MATH_REGEX = /\$\$([\s\\S]+?)\$\$|\$([^$]+?)\$/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasMatch = false;

  while ((match = MATH_REGEX.exec(text)) !== null) {
    hasMatch = true;
    // $..$ 앞의 일반 텍스트는 이스케이프
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const latex = match[1] ?? match[2] ?? "";
    const isDisplay = match[1] != null;
    const { html } = renderLatex(latex, { displayMode: isDisplay });
    parts.push(html);
    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  // $ 구분자가 전혀 없으면 전체를 display 모드 LaTeX로 렌더링
  if (!hasMatch) {
    const { html } = renderLatex(text, { displayMode: true });
    return html;
  }

  return parts.join("");
}

/** HTML 특수 문자를 이스케이프한다. */
function escapeHtml(text: string): string {
  const MAP: Readonly<Record<string, string>> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (ch) => MAP[ch] ?? ch);
}

/** Date를 한국식 날짜 문자열(YYYY년 MM월 DD일)로 변환한다. */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${d}일`;
}
