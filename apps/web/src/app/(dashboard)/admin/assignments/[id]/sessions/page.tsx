"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// --- 상수 ---

/** 세션 상태 필터 옵션 */
const STATUS_FILTERS = [
  { value: "", label: "전체" },
  { value: "in_progress", label: "진행 중" },
  { value: "submitted", label: "제출됨" },
  { value: "graded", label: "채점 완료" },
] as const;

/** 상태 배지 스타일 */
const STATUS_BADGE_STYLES: Readonly<Record<string, string>> = {
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-yellow-100 text-yellow-800",
  graded: "bg-green-100 text-green-800",
};

/** 상태 한국어 라벨 */
const STATUS_LABELS: Readonly<Record<string, string>> = {
  in_progress: "진행 중",
  submitted: "제출됨",
  graded: "채점 완료",
};

/** 페이지당 항목 수 */
const PAGE_SIZE = 20;

// --- 날짜 포맷 ---

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- 메인 페이지 ---

export default function SessionsListPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = use(params);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, error, refetch } =
    trpc.worksheet.listSessions.useQuery({
      assignmentId,
      page,
      limit: PAGE_SIZE,
      status: statusFilter.length > 0 ? (statusFilter as "in_progress" | "submitted" | "graded") : undefined,
    });

  const handleStatusChange = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  // --- 로딩 ---

  if (isLoading) {
    return <SessionsSkeleton />;
  }

  // --- 에러 ---

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">
          {error?.message ?? "세션 목록을 불러올 수 없습니다."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  const { sessions, total } = data;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link
            href={`/admin/assignments/${assignmentId}` as any}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; 학습지 상세
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            풀이 세션 ({total})
          </h1>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleStatusChange(filter.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === filter.value
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* 세션 테이블 */}
      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium text-slate-500">
                  학생 이름
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">
                  상태
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">
                  점수
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">
                  제출 시각
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  assignmentId={assignmentId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
        />
      )}
    </div>
  );
}

// --- 세션 행 ---

interface SessionRowProps {
  readonly session: {
    readonly id: string;
    readonly studentName: string;
    readonly status: string;
    readonly totalScore: unknown;
    readonly maxScore: unknown;
    readonly submittedAt: Date | string | null;
  };
  readonly assignmentId: string;
}

function SessionRow({ session, assignmentId }: SessionRowProps) {
  const statusStyle =
    STATUS_BADGE_STYLES[session.status] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  const totalScore =
    session.totalScore != null ? Number(session.totalScore) : null;
  const maxScore =
    session.maxScore != null ? Number(session.maxScore) : null;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link
      href={
        `/admin/assignments/${assignmentId}/sessions/${session.id}` as any
      }
      className="contents"
    >
      <tr className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50">
        <td className="px-4 py-3 font-medium text-slate-800">
          {session.studentName}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              statusStyle,
            )}
          >
            {statusLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-600">
          {totalScore != null && maxScore != null
            ? `${totalScore} / ${maxScore}`
            : "-"}
        </td>
        <td className="px-4 py-3 text-slate-500">
          {formatDateTime(session.submittedAt)}
        </td>
      </tr>
    </Link>
  );
}

// --- 빈 상태 ---

function EmptyState() {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-slate-200 bg-white">
      <p className="text-sm text-slate-500">아직 풀이 세션이 없습니다.</p>
    </div>
  );
}

// --- 페이지네이션 ---

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={onPrev}
      >
        이전
      </Button>
      <span className="text-sm text-slate-500">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        다음
      </Button>
    </div>
  );
}

// --- 스켈레톤 ---

function SessionsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-16 animate-pulse rounded-full bg-slate-200"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    </div>
  );
}
