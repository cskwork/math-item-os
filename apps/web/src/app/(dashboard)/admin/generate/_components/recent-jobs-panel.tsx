// 최근 생성 작업 이력 패널

interface JobSummary {
  readonly jobId: string;
  readonly status: string;
  readonly strategy?: string;
  readonly templateTitle?: string;
  readonly variantCount: number;
  readonly passRate: number;
  readonly error?: string;
  readonly createdAt: number;
}

interface RecentJobsPanelProps {
  readonly jobs: readonly JobSummary[];
  readonly currentJobId: string | null;
  readonly onSelectJob: (jobId: string) => void;
}

const JOB_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  processing: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  processing: "진행",
  completed: "완료",
  failed: "실패",
};

export function RecentJobsPanel({
  jobs,
  currentJobId,
  onSelectJob,
}: RecentJobsPanelProps) {
  if (jobs.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">
        최근 생성 작업
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {jobs.map((job) => {
          const isCurrent = job.jobId === currentJobId;
          const statusStyle =
            JOB_STATUS_STYLES[job.status] ?? "bg-slate-100 text-slate-600";
          const statusLabel =
            JOB_STATUS_LABELS[job.status] ?? job.status;
          const timeStr = new Date(job.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <li key={job.jobId}>
              <button
                type="button"
                onClick={() => onSelectJob(job.jobId)}
                className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isCurrent
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {job.status === "processing" && (
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
                    )}
                    <span className="truncate text-slate-700">
                      {job.templateTitle ?? job.jobId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusStyle}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-slate-400">{timeStr}</span>
                  </div>
                </div>
                <div className="mt-0.5 flex gap-3 text-slate-500">
                  {job.variantCount > 0 && (
                    <span>{job.variantCount}건</span>
                  )}
                  {job.status === "completed" && (
                    <span>
                      통과율 {Math.round(job.passRate * 100)}%
                    </span>
                  )}
                  {job.strategy && (
                    <span className="uppercase">{job.strategy}</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
