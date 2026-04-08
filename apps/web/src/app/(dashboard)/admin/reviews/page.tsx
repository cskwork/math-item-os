"use client";

import { useState, useCallback } from "react";

import { trpc } from "@/lib/trpc";
import { ReviewTaskTable } from "@/components/admin/review-task-table";

// --- 상수 ---

const PAGE_LIMIT = 20;

// --- 필터 옵션 ---

const TASK_TYPE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "tag_review", label: "태그 검수" },
  { value: "generation_review", label: "생성 검수" },
  { value: "duplicate_review", label: "중복 검수" },
  { value: "explanation_error", label: "풀이 오류" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "pending", label: "대기" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "rejected", label: "반려" },
] as const;

const PRIORITY_OPTIONS = [
  { value: 0, label: "전체" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
] as const;

// --- 메인 페이지 ---

export default function ReviewQueuePage() {
  // 필터 상태
  const [taskTypeFilter, setTaskTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState(0);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);

  // --- tRPC 쿼리 ---

  const tasksQuery = trpc.admin.listReviewTasks.useQuery({
    page,
    limit: PAGE_LIMIT,
    ...(taskTypeFilter !== "" && { taskType: taskTypeFilter }),
    ...(statusFilter !== "" && { status: statusFilter }),
    ...(priorityFilter > 0 && { priority: priorityFilter }),
  });

  // --- tRPC 뮤테이션 ---

  const updateTaskMutation = trpc.admin.updateReviewTask.useMutation({
    onSuccess: () => {
      tasksQuery.refetch();
    },
  });

  // --- 핸들러 ---

  const handleTaskTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTaskTypeFilter(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(e.target.value);
      setPage(1);
    },
    [],
  );

  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setPriorityFilter(Number(e.target.value));
      setPage(1);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setTaskTypeFilter("");
    setStatusFilter("");
    setPriorityFilter(0);
    setPage(1);
  }, []);

  const handleApprove = useCallback(
    (taskId: string) => {
      updateTaskMutation.mutate({ taskId, status: "completed" });
    },
    [updateTaskMutation],
  );

  const handleReject = useCallback(
    (taskId: string) => {
      updateTaskMutation.mutate({ taskId, status: "rejected" });
    },
    [updateTaskMutation],
  );

  // --- 파생 상태 ---

  const tasks = tasksQuery.data?.tasks ?? [];
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const hasActiveFilter =
    taskTypeFilter !== "" || statusFilter !== "" || priorityFilter > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">검수 대기열</h1>
        <p className="text-sm text-slate-500">
          검수가 필요한 문항을 확인하고 승인 또는 반려합니다
        </p>
      </div>

      {/* 필터 바 */}
      <FilterBar
        taskType={taskTypeFilter}
        status={statusFilter}
        priority={priorityFilter}
        hasActiveFilter={hasActiveFilter}
        onTaskTypeChange={handleTaskTypeChange}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onReset={handleResetFilters}
      />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {tasksQuery.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">검수 태스크 불러오는 중...</p>
          </div>
        ) : tasksQuery.isError ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-red-600">
              데이터 조회 실패: {tasksQuery.error.message}
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">
              {hasActiveFilter
                ? "필터 조건에 맞는 태스크가 없습니다"
                : "검수 대기 중인 태스크가 없습니다"}
            </p>
          </div>
        ) : (
          <ReviewTaskTable
            tasks={tasks}
            mutatingTaskId={
              updateTaskMutation.isPending
                ? updateTaskMutation.variables?.taskId ?? null
                : null
            }
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>

      {/* 뮤테이션 오류 */}
      {updateTaskMutation.isError && (
        <p className="text-sm text-red-600">
          상태 변경 실패: {updateTaskMutation.error.message}
        </p>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages} (총 {total}건)
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// --- 필터 바 ---

interface FilterBarProps {
  readonly taskType: string;
  readonly status: string;
  readonly priority: number;
  readonly hasActiveFilter: boolean;
  readonly onTaskTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  readonly onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  readonly onPriorityChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  readonly onReset: () => void;
}

function FilterBar({
  taskType,
  status,
  priority,
  hasActiveFilter,
  onTaskTypeChange,
  onStatusChange,
  onPriorityChange,
  onReset,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      {/* 태스크 유형 */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="filter-task-type"
          className="text-xs font-medium text-slate-600"
        >
          유형
        </label>
        <select
          id="filter-task-type"
          value={taskType}
          onChange={onTaskTypeChange}
          className="h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        >
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 상태 */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="filter-status"
          className="text-xs font-medium text-slate-600"
        >
          상태
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={onStatusChange}
          className="h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 우선순위 */}
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="filter-priority"
          className="text-xs font-medium text-slate-600"
        >
          우선순위
        </label>
        <select
          id="filter-priority"
          value={priority}
          onChange={onPriorityChange}
          className="h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 필터 초기화 */}
      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
