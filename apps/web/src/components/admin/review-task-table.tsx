// 검수 태스크 테이블 컴포넌트

import { KatexRenderer } from "@/components/math/katex-renderer";

// --- 태스크 타입 라벨 ---

export const TASK_TYPE_LABEL: Readonly<Record<string, string>> = {
  tag_review: "태그 검수",
  generation_review: "생성 검수",
  duplicate_review: "중복 검수",
  explanation_error: "풀이 오류",
};

// --- 상태 라벨 및 색상 ---

export const STATUS_CONFIG: Readonly<
  Record<string, { readonly label: string; readonly className: string }>
> = {
  pending: { label: "대기", className: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "진행중", className: "bg-blue-100 text-blue-800" },
  completed: { label: "완료", className: "bg-green-100 text-green-800" },
  rejected: { label: "반려", className: "bg-red-100 text-red-800" },
};

// --- 우선순위 색상 ---

const PRIORITY_COLOR: Readonly<Record<number, string>> = {
  1: "bg-slate-400",
  2: "bg-blue-400",
  3: "bg-yellow-400",
  4: "bg-orange-400",
  5: "bg-red-500",
};

// --- 검수 태스크 데이터 타입 ---

export interface ReviewTaskData {
  readonly id: string;
  readonly itemId: string;
  readonly itemTitle: string;
  readonly taskType: string;
  readonly status: string;
  readonly assigneeId: string | null;
  readonly priority: number;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly isGenerated: boolean;
  readonly createdAt: Date;
}

// --- 테이블 ---

interface ReviewTaskTableProps {
  readonly tasks: readonly ReviewTaskData[];
  readonly mutatingTaskId: string | null;
  readonly onApprove: (taskId: string) => void;
  readonly onReject: (taskId: string) => void;
}

export function ReviewTaskTable({
  tasks,
  mutatingTaskId,
  onApprove,
  onReject,
}: ReviewTaskTableProps) {
  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              우선순위
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              문항 제목
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              유형
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              상태
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              학교급/학년
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
              등록일
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
              작업
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <ReviewTaskRow
              key={task.id}
              task={task}
              isMutating={mutatingTaskId === task.id}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- 태스크 행 ---

interface ReviewTaskRowProps {
  readonly task: ReviewTaskData;
  readonly isMutating: boolean;
  readonly onApprove: (taskId: string) => void;
  readonly onReject: (taskId: string) => void;
}

function ReviewTaskRow({
  task,
  isMutating,
  onApprove,
  onReject,
}: ReviewTaskRowProps) {
  const statusConfig = STATUS_CONFIG[task.status] ?? {
    label: task.status,
    className: "bg-slate-100 text-slate-600",
  };

  const priorityDotColor = PRIORITY_COLOR[task.priority] ?? "bg-slate-300";
  const taskTypeLabel = TASK_TYPE_LABEL[task.taskType] ?? task.taskType;

  const formattedDate = new Date(task.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const isActionable =
    task.status === "pending" || task.status === "in_progress";

  return (
    <tr className="transition-colors hover:bg-slate-50">
      {/* 우선순위 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${priorityDotColor}`} />
          <span className="text-xs font-medium text-slate-700">
            {task.priority}
          </span>
        </div>
      </td>

      {/* 문항 제목 */}
      <td className="max-w-[280px] px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs text-slate-800">
            <KatexRenderer latex={task.itemTitle} displayMode={false} />
          </p>
          {task.isGenerated && (
            <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
              생성
            </span>
          )}
        </div>
      </td>

      {/* 유형 */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-600">{taskTypeLabel}</span>
      </td>

      {/* 상태 */}
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
      </td>

      {/* 학교급/학년 */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-600">
          {task.schoolLevel} {task.grade}학년
        </span>
      </td>

      {/* 등록일 */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500">{formattedDate}</span>
      </td>

      {/* 작업 */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {isActionable ? (
            <>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onApprove(task.id)}
                className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutating ? "처리중..." : "검수 완료"}
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onReject(task.id)}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                반려
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">-</span>
          )}
        </div>
      </td>
    </tr>
  );
}
