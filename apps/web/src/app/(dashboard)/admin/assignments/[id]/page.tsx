"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";
import type { Prisma } from "@math-item-os/db";

// --- 상수 ---

/** 학습지 목적 라벨 (한국어) */
const PURPOSE_LABELS: Readonly<Record<string, string>> = {
  diagnosis: "진단평가",
  remediation: "보충학습",
  pre_exam: "시험대비",
  advanced: "심화학습",
};

/** 난이도 배지 색상 */
const DIFFICULTY_COLORS: Readonly<Record<number, string>> = {
  1: "bg-green-100 text-green-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

/** 복사 완료 피드백 표시 시간(ms) */
const COPY_FEEDBACK_DURATION_MS = 2_000;

// --- 날짜 포맷 ---

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// --- 문항 콘텐츠 미리보기 (LaTeX/HTML 잘라내기) ---

function truncateContent(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\\ldots`;
}

// --- 메인 페이지 ---

export default function AssignmentDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  // Next.js 15: params는 Promise이므로 use()로 unwrap
  const { id } = use(params);

  // 내보내기 상태
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- tRPC 쿼리 ---

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.admin.getAssignment.useQuery({ id });

  // --- tRPC 뮤테이션 ---

  const publishMutation = trpc.admin.publishAssignment.useMutation({
    onSuccess: (result) => {
      void refetch();
      if (result.shareUrl) {
        setShareUrl(result.shareUrl);
      }
      toast.success("학습지가 공개되었습니다");
    },
    onError: () => {
      toast.error("학습지 공개에 실패했습니다");
    },
  });

  const exportMutation = trpc.admin.exportAssignment.useMutation({
    onError: () => {
      toast.error("내보내기에 실패했습니다");
    },
  });

  // --- 핸들러 ---

  /** PDF 다운로드 */
  const handlePdfExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        assignmentId: id,
        format: "pdf",
      });
      // PDF URL을 새 탭에서 열기
      window.open(result.url, "_blank");
    } finally {
      setIsExporting(false);
    }
  }, [id, exportMutation]);

  /** 공유 링크 생성 (미공개 시 먼저 공개 처리) */
  const handleShareLink = useCallback(async () => {
    setIsExporting(true);
    try {
      // 미공개 학습지인 경우 먼저 공개 처리
      if (!data?.assignment.isPublished) {
        const publishResult = await publishMutation.mutateAsync({ id });
        setShareUrl(publishResult.shareUrl);
      } else {
        const result = await exportMutation.mutateAsync({
          assignmentId: id,
          format: "link",
        });
        setShareUrl(result.url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [id, data, publishMutation, exportMutation]);

  /** 공유 링크 클립보드 복사 */
  const handleCopyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), COPY_FEEDBACK_DURATION_MS);
    } catch {
      // 클립보드 API 실패 시 무시 (보안 컨텍스트 필요)
    }
  }, [shareUrl]);

  /** 공개하기 */
  const handlePublish = useCallback(() => {
    publishMutation.mutate({ id });
  }, [id, publishMutation]);

  // --- 로딩 상태 ---

  if (isLoading) {
    return <AssignmentSkeleton />;
  }

  // --- 에러 상태 ---

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">
          {error?.message ?? "학습지를 찾을 수 없습니다."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            다시 시도
          </Button>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={"/admin/assignments" as any}>
            <Button variant="outline" size="sm">
              목록으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { assignment } = data;
  const purposeLabel = PURPOSE_LABELS[assignment.purpose] ?? assignment.purpose;
  const totalPoints = calculateTotalPoints(assignment.items);
  const itemCount = assignment.items.length;

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* --- 헤더 --- */}
      <AssignmentHeader
        title={assignment.title}
        isPublished={assignment.isPublished}
        isPublishing={publishMutation.isPending}
        onPublish={handlePublish}
      />

      {/* 뮤테이션 에러 표시 */}
      {publishMutation.error && (
        <ErrorBanner message={publishMutation.error.message} />
      )}
      {exportMutation.error && (
        <ErrorBanner message={exportMutation.error.message} />
      )}

      <div className="flex flex-col gap-5">
        {/* --- 메타 정보 --- */}
        <MetaSection
          purposeLabel={purposeLabel}
          itemCount={itemCount}
          totalPoints={totalPoints}
          isPublished={assignment.isPublished}
          createdAt={assignment.createdAt}
        />

        {/* --- 문항 목록 --- */}
        <ItemsSection items={assignment.items} />

        {/* --- 내보내기 --- */}
        <ExportSection
          isExporting={isExporting}
          shareUrl={shareUrl}
          copySuccess={copySuccess}
          onPdfExport={handlePdfExport}
          onShareLink={handleShareLink}
          onCopyShareUrl={handleCopyShareUrl}
        />
      </div>
    </div>
  );
}

// --- 총 배점 계산 ---

interface AssignmentItemForPoints {
  readonly points: number | string | Prisma.Decimal | null;
}

function calculateTotalPoints(
  items: readonly AssignmentItemForPoints[],
): number {
  return items.reduce((sum, item) => {
    const points = item.points != null ? Number(item.points) : 0;
    return sum + points;
  }, 0);
}

// --- 로딩 스켈레톤 ---

function AssignmentSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="flex flex-col gap-5">
        <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
        <div className="h-32 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
      </div>
    </div>
  );
}

// --- 헤더 섹션 ---

interface AssignmentHeaderProps {
  readonly title: string;
  readonly isPublished: boolean;
  readonly isPublishing: boolean;
  readonly onPublish: () => void;
}

function AssignmentHeader({
  title,
  isPublished,
  isPublishing,
  onPublish,
}: AssignmentHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={"/admin/assignments" as any}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          &larr; 학습지 목록
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          학습지: {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {isPublished ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
            공개됨
          </span>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={isPublishing}
            onClick={onPublish}
          >
            {isPublishing ? "공개 처리 중..." : "공개하기"}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- 에러 배너 ---

function ErrorBanner({ message }: { readonly message: string }) {
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
      <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
    </div>
  );
}

// --- 메타 정보 섹션 ---

interface MetaSectionProps {
  readonly purposeLabel: string;
  readonly itemCount: number;
  readonly totalPoints: number;
  readonly isPublished: boolean;
  readonly createdAt: Date | string;
}

function MetaSection({
  purposeLabel,
  itemCount,
  totalPoints,
  isPublished,
  createdAt,
}: MetaSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-500 dark:text-slate-400">목적:</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {purposeLabel}
          </span>
        </div>
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500 dark:text-slate-400">문항 수:</span>{" "}
          {itemCount}
        </div>
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500 dark:text-slate-400">총 배점:</span>{" "}
          {totalPoints}
        </div>
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500 dark:text-slate-400">상태:</span>{" "}
          {isPublished ? "공개" : "비공개"}
        </div>
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500 dark:text-slate-400">생성일:</span>{" "}
          {formatDate(createdAt)}
        </div>
      </div>
    </section>
  );
}

// --- 문항 목록 섹션 ---

interface AssignmentItemData {
  readonly id: string;
  readonly position: number;
  readonly points: number | string | Prisma.Decimal | null;
  readonly item: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly bodyHtml?: string | null;
    readonly itemType: string;
    readonly difficultyAuthor?: number | null;
    readonly difficultyProfile?: {
      readonly authorDifficulty: number;
    } | null;
  };
}

interface ItemsSectionProps {
  readonly items: readonly AssignmentItemData[];
}

function ItemsSection({ items }: ItemsSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
        문항 목록 ({items.length})
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 문항이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((ai) => (
            <AssignmentItemRow
              key={ai.id}
              position={ai.position}
              item={ai.item}
              points={ai.points}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// --- 개별 문항 행 ---

interface AssignmentItemRowProps {
  readonly position: number;
  readonly item: AssignmentItemData["item"];
  readonly points: number | string | Prisma.Decimal | null;
}

function AssignmentItemRow({ position, item, points }: AssignmentItemRowProps) {
  const difficulty = item.difficultyAuthor ?? item.difficultyProfile?.authorDifficulty;
  const difficultyColor = difficulty != null
    ? DIFFICULTY_COLORS[difficulty] ?? "bg-slate-100 text-slate-700"
    : null;

  const contentPreview = item.bodyHtml
    ? truncateContent(item.bodyHtml.replace(/<[^>]*>/g, ""))
    : truncateContent(item.bodyLatex);

  const pointsDisplay = points != null ? Number(points) : null;

  return (
    <li className="flex items-center gap-3 rounded-md border border-slate-100 px-4 py-3 dark:border-slate-700">
      {/* 번호 */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
        {position + 1}
      </span>

      {/* 콘텐츠 미리보기 */}
      <p className="min-w-0 flex-1 truncate text-sm text-slate-800">
        <KatexRenderer latex={contentPreview} displayMode={false} />
      </p>

      {/* 문항 유형 배지 */}
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        {item.itemType}
      </span>

      {/* 난이도 배지 */}
      {difficulty != null && difficultyColor && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            difficultyColor,
          )}
        >
          난이도{difficulty}
        </span>
      )}

      {/* 배점 */}
      {pointsDisplay != null && (
        <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
          {pointsDisplay}점
        </span>
      )}
    </li>
  );
}

// --- 내보내기 섹션 ---

interface ExportSectionProps {
  readonly isExporting: boolean;
  readonly shareUrl: string | null;
  readonly copySuccess: boolean;
  readonly onPdfExport: () => void;
  readonly onShareLink: () => void;
  readonly onCopyShareUrl: () => void;
}

function ExportSection({
  isExporting,
  shareUrl,
  copySuccess,
  onPdfExport,
  onShareLink,
  onCopyShareUrl,
}: ExportSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">내보내기</h2>

      <div className="flex flex-col gap-4">
        {/* 버튼 행 */}
        <div className="flex gap-3">
          <Button
            variant="default"
            size="sm"
            disabled={isExporting}
            onClick={onPdfExport}
          >
            {isExporting ? "처리 중..." : "PDF 다운로드"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={onShareLink}
          >
            {isExporting ? "처리 중..." : "공유 링크 생성"}
          </Button>
        </div>

        {/* 공유 링크 표시 */}
        {shareUrl && (
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              공유 링크:
            </span>
            <code className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-300">
              {shareUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyShareUrl}
              className="shrink-0"
            >
              {copySuccess ? "복사됨!" : "복사"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
