"use client";

// 성과 분석 대시보드 - 과제별 점수 통계, typeLevel 분석, 취약 유형, 학생 결과

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ScoreSummaryCards } from "@/components/analytics/score-summary-cards";
import { TypeLevelChart } from "@/components/analytics/type-level-chart";
import { WeakTypeAlert } from "@/components/analytics/weak-type-alert";
import type { TypeLevelStat } from "@math-item-os/shared/types/index";

// -------------------------------------------------
// 상수
// -------------------------------------------------

/** 취약 유형 판별 임계값 */
const WEAK_THRESHOLD = 0.6;

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

// -------------------------------------------------
// 날짜 포맷
// -------------------------------------------------

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

// -------------------------------------------------
// 메인 페이지
// -------------------------------------------------

export default function AnalyticsPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // 과제 전체 통계
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = trpc.analytics.assignmentOverview.useQuery({ assignmentId: id });

  // 채점 완료 세션 목록 (학생별 결과 표시용)
  const { data: sessionsData, isLoading: sessionsLoading } =
    trpc.worksheet.listSessions.useQuery({
      assignmentId: id,
      status: "graded",
      page: 1,
      limit: 100,
    });

  // 취약 유형은 overview 데이터에서 클라이언트 측 필터링
  const weakTypes: ReadonlyArray<TypeLevelStat> =
    overview?.typeLevelStats.filter((s) => s.correctRate < WEAK_THRESHOLD) ??
    [];

  // --- 로딩 ---

  if (overviewLoading) {
    return <AnalyticsSkeleton />;
  }

  // --- 에러 ---

  if (overviewError || !overview) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">
          {overviewError?.message ?? "분석 데이터를 불러올 수 없습니다."}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchOverview()}
          >
            다시 시도
          </Button>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={`/admin/assignments/${id}` as any}>
            <Button variant="outline" size="sm">
              학습지 상세로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- 데이터 없음 ---

  if (overview.sessionCount === 0) {
    return (
      <div className="mx-auto max-w-4xl pb-12">
        <PageHeader assignmentId={id} />
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white">
          <p className="text-sm text-slate-500">
            채점 완료된 세션이 없습니다.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            학생이 풀이를 제출하면 분석 결과가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  const sessions = sessionsData?.sessions ?? [];

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* 헤더 */}
      <PageHeader assignmentId={id} />

      <div className="flex flex-col gap-5">
        {/* 세션 수 요약 */}
        <p className="text-sm text-slate-500">
          채점 완료 세션: <span className="font-semibold text-slate-700">{overview.sessionCount}</span>건
        </p>

        {/* 점수 요약 카드 */}
        <section>
          <SectionTitle title="점수 요약" />
          <ScoreSummaryCards
            avgScore={overview.avgScore}
            medianScore={overview.medianScore}
            minScore={overview.minScore}
            maxScore={overview.maxScore}
          />
        </section>

        {/* typeLevel별 정답률 차트 */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <SectionTitle title="유형별 정답률" />
          <TypeLevelChart stats={overview.typeLevelStats} />
        </section>

        {/* 취약 유형 알림 */}
        <WeakTypeAlert weakTypes={weakTypes} />

        {/* 학생별 결과 테이블 */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <SectionTitle title="학생별 결과" />
          {sessionsLoading ? (
            <div className="h-32 animate-pulse rounded bg-slate-50" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400">
              채점 완료된 학생이 없습니다.
            </p>
          ) : (
            <StudentResultsTable sessions={sessions} assignmentId={id} />
          )}
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------
// 페이지 헤더
// -------------------------------------------------

function PageHeader({ assignmentId }: { readonly assignmentId: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={`/admin/assignments/${assignmentId}` as any}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; 학습지 상세
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">성과 분석</h1>
      </div>
    </div>
  );
}

// -------------------------------------------------
// 섹션 제목
// -------------------------------------------------

function SectionTitle({ title }: { readonly title: string }) {
  return (
    <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
  );
}

// -------------------------------------------------
// 학생 결과 테이블
// -------------------------------------------------

interface SessionRow {
  readonly id: string;
  readonly studentName: string;
  readonly status: string;
  readonly totalScore: unknown;
  readonly maxScore: unknown;
  readonly submittedAt: Date | string | null;
  readonly gradedAt?: Date | string | null;
}

interface StudentResultsTableProps {
  readonly sessions: ReadonlyArray<SessionRow>;
  readonly assignmentId: string;
}

function StudentResultsTable({
  sessions,
  assignmentId,
}: StudentResultsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-4 py-3 text-left font-medium text-slate-500">
              이름
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">
              점수
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">
              상태
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">
              채점 시각
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <StudentRow
              key={session.id}
              session={session}
              assignmentId={assignmentId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------
// 학생 행
// -------------------------------------------------

interface StudentRowProps {
  readonly session: SessionRow;
  readonly assignmentId: string;
}

function StudentRow({ session, assignmentId }: StudentRowProps) {
  const totalScore =
    session.totalScore != null ? Number(session.totalScore) : null;
  const maxScore =
    session.maxScore != null ? Number(session.maxScore) : null;

  const statusStyle =
    STATUS_BADGE_STYLES[session.status] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

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
        <td className="px-4 py-3 text-slate-600">
          {totalScore != null && maxScore != null
            ? `${totalScore} / ${maxScore}`
            : "-"}
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
        <td className="px-4 py-3 text-slate-500">
          {formatDateTime(session.gradedAt ?? session.submittedAt)}
        </td>
      </tr>
    </Link>
  );
}

// -------------------------------------------------
// 스켈레톤
// -------------------------------------------------

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="flex flex-col gap-5">
        {/* 카드 스켈레톤 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
        {/* 차트 스켈레톤 */}
        <div className="h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
        {/* 테이블 스켈레톤 */}
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
      </div>
    </div>
  );
}
