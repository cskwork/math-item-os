"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";

// --- 상수 ---

/** 결과 배지 스타일 */
const RESULT_BADGE_STYLES: Readonly<Record<string, string>> = {
  correct: "bg-green-100 text-green-800",
  incorrect: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-gray-100 text-gray-500",
};

/** 결과 한국어 라벨 */
const RESULT_LABELS: Readonly<Record<string, string>> = {
  correct: "정답",
  incorrect: "오답",
  partial: "부분 정답",
  pending: "미채점",
  skipped: "건너뜀",
};

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

export default function SessionDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: assignmentId, sessionId } = use(params);

  // 세션 상세 (getResults는 토큰 기반이므로, 교사용에는 직접 워크시트 라우터 사용)
  // 세션 목록에서 이미 기본 정보를 갖고 있으므로, 워크시트 생성 쿼리로 오답 데이터를 가져옴
  const {
    data: worksheetData,
    isLoading: isLoadingWorksheet,
    error: worksheetError,
  } = trpc.worksheet.generate.useQuery(
    { sessionId },
    { retry: false },
  );

  // 세션 목록에서 해당 세션 정보를 가져오기 위해 listSessions 사용
  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
  } = trpc.worksheet.listSessions.useQuery({
    assignmentId,
    page: 1,
    limit: 100,
  });

  const isLoading = isLoadingWorksheet || isLoadingSessions;

  if (isLoading) {
    return <DetailSkeleton />;
  }

  // 현재 세션 찾기
  const currentSession = sessionsData?.sessions.find(
    (s) => s.id === sessionId,
  );

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* 헤더 네비게이션 */}
      <div className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={`/admin/assignments/${assignmentId}/sessions` as any}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          &larr; 세션 목록
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">세션 상세</h1>
      </div>

      {/* 학생 정보 헤더 */}
      {currentSession && (
        <StudentInfoCard session={currentSession} />
      )}

      {/* 오답 워크시트 에러 (채점 미완료 등) */}
      {worksheetError && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-sm text-yellow-700">
            오답 워크시트: {worksheetError.message}
          </p>
        </div>
      )}

      {/* 오답 워크시트 항목 */}
      {worksheetData && worksheetData.items.length > 0 && (
        <ErrorWorksheetSection
          items={worksheetData.items}
        />
      )}

      {/* 오답 없음 */}
      {worksheetData && worksheetData.items.length === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm text-green-700">
            모든 문항을 정확히 풀었습니다. 오답이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}

// --- 학생 정보 카드 ---

interface StudentInfoCardProps {
  readonly session: {
    readonly id: string;
    readonly studentName: string;
    readonly status: string;
    readonly totalScore: unknown;
    readonly maxScore: unknown;
    readonly startedAt: Date | string | null;
    readonly submittedAt: Date | string | null;
    readonly gradedAt: Date | string | null;
  };
}

function StudentInfoCard({ session }: StudentInfoCardProps) {
  const statusStyle =
    STATUS_BADGE_STYLES[session.status] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  const totalScore =
    session.totalScore != null ? Number(session.totalScore) : null;
  const maxScore =
    session.maxScore != null ? Number(session.maxScore) : null;

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="font-medium text-slate-500">학생:</span>{" "}
          <span className="font-semibold text-slate-800">
            {session.studentName}
          </span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-500">상태:</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              statusStyle,
            )}
          >
            {statusLabel}
          </span>
        </div>
        {totalScore != null && maxScore != null && (
          <>
            <span className="text-slate-300">|</span>
            <div>
              <span className="font-medium text-slate-500">점수:</span>{" "}
              <span className="font-semibold text-slate-800">
                {totalScore} / {maxScore}
              </span>
            </div>
          </>
        )}
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500">시작:</span>{" "}
          {formatDateTime(session.startedAt)}
        </div>
        <span className="text-slate-300">|</span>
        <div>
          <span className="font-medium text-slate-500">제출:</span>{" "}
          {formatDateTime(session.submittedAt)}
        </div>
        {session.gradedAt && (
          <>
            <span className="text-slate-300">|</span>
            <div>
              <span className="font-medium text-slate-500">채점:</span>{" "}
              {formatDateTime(session.gradedAt)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// --- 오답 워크시트 섹션 ---

interface ErrorWorksheetSectionProps {
  readonly items: ReadonlyArray<{
    readonly originalItemId: string;
    readonly originalItem: {
      readonly id: string;
      readonly bodyLatex: string;
      readonly bodyHtml: string | null;
      readonly choices: unknown;
      readonly answer: unknown;
      readonly itemType: string;
      readonly answerFormat: string;
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
  }>;
}

function ErrorWorksheetSection({ items }: ErrorWorksheetSectionProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="flex flex-col gap-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          오답 워크시트 ({items.length}문항)
        </h2>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          오답 워크시트 인쇄
        </Button>
      </div>

      {/* 오답 문항 카드 */}
      {items.map((entry, index) => (
        <ErrorItemCard key={entry.originalItemId} entry={entry} index={index} />
      ))}
    </section>
  );
}

// --- 개별 오답 문항 카드 ---

interface ErrorItemCardProps {
  readonly entry: ErrorWorksheetSectionProps["items"][number];
  readonly index: number;
}

function ErrorItemCard({ entry, index }: ErrorItemCardProps) {
  const resultStyle =
    RESULT_BADGE_STYLES[entry.result] ?? RESULT_BADGE_STYLES.pending;
  const resultLabel = RESULT_LABELS[entry.result] ?? entry.result;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* 헤더: 번호 + 결과 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
            {index + 1}
          </span>
          <span className="text-xs text-slate-400">
            {entry.originalItem.itemType}
          </span>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            resultStyle,
          )}
        >
          {resultLabel}
        </span>
      </div>

      {/* 문제 본문 */}
      <div className="mb-3 rounded-md bg-slate-50 p-3">
        <KatexRenderer latex={entry.originalItem.bodyLatex} displayMode />
      </div>

      {/* 학생 답변 vs 정답 */}
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-red-100 bg-red-50 p-2">
          <span className="block text-xs font-medium text-red-600">
            학생 답변
          </span>
          <span className="text-slate-700">
            {entry.originalItem.answerFormat === "expression" ? (
              <KatexRenderer latex={formatAnswer(entry.studentAnswer)} displayMode={false} className="inline text-sm" />
            ) : (
              formatAnswer(entry.studentAnswer)
            )}
          </span>
        </div>
        <div className="rounded-md border border-green-100 bg-green-50 p-2">
          <span className="block text-xs font-medium text-green-600">
            정답
          </span>
          <span className="text-slate-700">
            {entry.originalItem.answerFormat === "expression" ? (
              <KatexRenderer latex={formatAnswer(entry.correctAnswer)} displayMode={false} className="inline text-sm" />
            ) : (
              formatAnswer(entry.correctAnswer)
            )}
          </span>
        </div>
      </div>

      {/* 오개념 정보 */}
      {entry.misconceptions.length > 0 && (
        <MisconceptionsInfo misconceptions={entry.misconceptions} />
      )}

      {/* 유사 문항 (Twin Problems) */}
      {entry.twinProblems.length > 0 && (
        <TwinProblemsInfo twinProblems={entry.twinProblems} />
      )}
    </div>
  );
}

// --- 오개념 정보 ---

interface MisconceptionsInfoProps {
  readonly misconceptions: ReadonlyArray<{
    readonly id: string;
    readonly code: string;
    readonly title: string;
    readonly typicalError: string | null;
    readonly remediation: string | null;
    readonly severity: number;
  }>;
}

function MisconceptionsInfo({ misconceptions }: MisconceptionsInfoProps) {
  return (
    <div className="mb-3">
      <h4 className="mb-1.5 text-xs font-semibold text-slate-500">
        관련 오개념
      </h4>
      <div className="flex flex-col gap-2">
        {misconceptions.map((mc) => (
          <div
            key={mc.id}
            className="rounded-md border border-orange-100 bg-orange-50 p-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-orange-800">{mc.title}</span>
              <span className="rounded bg-orange-200 px-1.5 py-0.5 text-xs text-orange-700">
                심각도 {mc.severity}
              </span>
            </div>
            {mc.typicalError && (
              <p className="mt-1 text-xs text-slate-600">
                전형적 오류: {mc.typicalError}
              </p>
            )}
            {mc.remediation && (
              <p className="mt-1 text-xs text-slate-600">
                교정: {mc.remediation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 유사 문항 정보 ---

interface TwinProblemsInfoProps {
  readonly twinProblems: ReadonlyArray<{
    readonly itemId: string;
    readonly score: number;
    readonly explanation: string;
  }>;
}

function TwinProblemsInfo({ twinProblems }: TwinProblemsInfoProps) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold text-slate-500">
        유사 문항 추천
      </h4>
      <div className="flex flex-col gap-1.5">
        {twinProblems.map((tp) => (
          <div
            key={tp.itemId}
            className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
          >
            <span className="text-slate-600">{tp.explanation}</span>
            <span className="shrink-0 text-xs text-slate-400">
              유사도 {Math.round(tp.score * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 유틸리티 ---

/** 답변 값을 사람이 읽을 수 있는 문자열로 변환 */
function formatAnswer(answer: unknown): string {
  if (answer == null) return "-";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number") return String(answer);
  if (typeof answer === "object") {
    const obj = answer as Record<string, unknown>;
    if ("value" in obj && obj.value != null) return String(obj.value);
    return JSON.stringify(answer);
  }
  return String(answer);
}

// --- 스켈레톤 ---

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mb-6 h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
      <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    </div>
  );
}
