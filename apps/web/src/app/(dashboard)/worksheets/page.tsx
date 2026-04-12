"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- 상수 ---

const SESSIONS_PER_PAGE = 10;

// --- 메인 페이지 ---

export default function WorksheetsPage() {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [sessionsPage, setSessionsPage] = useState(1);

  // 학습지 목록 조회 (세션 필터용)
  const assignmentsQuery = trpc.admin.listAssignments.useQuery({
    page: 1,
    limit: 100,
  });

  // 세션 목록 조회
  const sessionsQuery = trpc.worksheet.listSessions.useQuery(
    {
      assignmentId: selectedAssignmentId,
      status: "graded",
      page: sessionsPage,
      limit: SESSIONS_PER_PAGE,
    },
    { enabled: selectedAssignmentId.length > 0 },
  );

  // 오답 워크시트 생성
  const worksheetQuery = trpc.worksheet.generate.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: selectedSessionId != null },
  );

  // --- 핸들러 ---

  const handleAssignmentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedAssignmentId(e.target.value);
      setSelectedSessionId(null);
      setSessionsPage(1);
    },
    [],
  );

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  // --- 데이터 ---

  const assignments = assignmentsQuery.data?.assignments ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];
  const sessionsTotal = sessionsQuery.data?.total ?? 0;
  const sessionsTotalPages = Math.max(
    1,
    Math.ceil(sessionsTotal / SESSIONS_PER_PAGE),
  );
  const worksheetItems = worksheetQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          오답 학습지
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          채점된 세션의 오답을 분석하고 유사 문항과 오개념을 확인합니다
        </p>
      </div>

      {/* 워크시트 상세 뷰 */}
      {selectedSessionId != null ? (
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            세션 목록으로
          </Button>

          {worksheetQuery.isLoading && (
            <p className="text-sm text-slate-400">오답 분석 중...</p>
          )}

          {worksheetQuery.isError && (
            <p className="text-sm text-red-600">
              오답 분석 실패: {worksheetQuery.error.message}
            </p>
          )}

          {worksheetItems.length === 0 && !worksheetQuery.isLoading && (
            <p className="text-sm text-slate-500">오답이 없습니다</p>
          )}

          {worksheetItems.map((entry, idx) => (
            <WorksheetEntryCard key={entry.originalItemId} entry={entry} index={idx} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 학습지 선택 */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="assignment-select"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              학습지
            </label>
            <select
              id="assignment-select"
              value={selectedAssignmentId}
              onChange={handleAssignmentChange}
              className="h-9 rounded-md border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">학습지를 선택하세요</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          {/* 세션 목록 */}
          {selectedAssignmentId.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {sessionsQuery.isLoading && (
                <p className="p-4 text-sm text-slate-400">세션 불러오는 중...</p>
              )}

              {sessions.length === 0 && !sessionsQuery.isLoading && (
                <p className="p-4 text-sm text-slate-500">
                  채점 완료된 세션이 없습니다
                </p>
              )}

              {sessions.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-700">
                      <th className="px-4 py-2">학생</th>
                      <th className="px-4 py-2">점수</th>
                      <th className="px-4 py-2">제출일</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                          {session.studentName ?? "익명"}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {Number(session.totalScore ?? 0)}/{Number(session.maxScore ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {session.submittedAt
                            ? new Date(session.submittedAt).toLocaleDateString(
                                "ko-KR",
                              )
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectSession(session.id)}
                          >
                            오답 분석
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {sessionsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={sessionsPage <= 1}
                    onClick={() => setSessionsPage((p) => p - 1)}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    이전
                  </button>
                  <span className="text-xs text-slate-500">
                    {sessionsPage} / {sessionsTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={sessionsPage >= sessionsTotalPages}
                    onClick={() => setSessionsPage((p) => p + 1)}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- 워크시트 항목 카드 ---

interface WorksheetEntryCardProps {
  readonly entry: {
    readonly originalItemId: string;
    readonly originalItem: {
      readonly bodyLatex: string;
      readonly itemType: string;
    };
    readonly studentAnswer: unknown;
    readonly correctAnswer: unknown;
    readonly result: string;
    readonly misconceptions: ReadonlyArray<{
      readonly id: string;
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
  };
  readonly index: number;
}

function WorksheetEntryCard({ entry, index }: WorksheetEntryCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* 문항 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-700">
          {index + 1}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            entry.result === "incorrect"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700",
          )}
        >
          {entry.result === "incorrect" ? "오답" : "부분 정답"}
        </span>
        <span className="text-xs text-slate-400">{entry.originalItem.itemType}</span>
      </div>

      {/* 문제 */}
      <div className="mb-3 rounded-md bg-slate-50 p-3 dark:bg-slate-800">
        <KatexRenderer latex={entry.originalItem.bodyLatex} displayMode />
      </div>

      {/* 답변 비교 */}
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">학생 답변</p>
          <p className="mt-1 text-red-600">{String(entry.studentAnswer ?? "-")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">정답</p>
          <p className="mt-1 text-green-600">{String(entry.correctAnswer ?? "-")}</p>
        </div>
      </div>

      {/* 오개념 */}
      {entry.misconceptions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-500">관련 오개념</p>
          <ul className="space-y-1">
            {entry.misconceptions.map((m) => (
              <li
                key={m.id}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20"
              >
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  {m.title}
                </span>
                {m.typicalError && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}— {m.typicalError}
                  </span>
                )}
                {m.remediation && (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    교정: {m.remediation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 유사 문항 */}
      {entry.twinProblems.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">
            연습용 유사 문항 ({entry.twinProblems.length}건)
          </p>
          <ul className="space-y-1">
            {entry.twinProblems.map((tp) => (
              <li
                key={tp.itemId}
                className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
              >
                <span className="text-slate-400">
                  유사도 {Math.round(tp.score * 100)}%
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {tp.explanation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
