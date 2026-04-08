"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// --- 타입 정의 ---

type FileFormat = "csv" | "json" | "qti";

type JobStatus = "pending" | "processing" | "completed" | "failed";

interface BulkUploadError {
  readonly row: number;
  readonly field?: string;
  readonly message: string;
}

// --- 상수 ---

const FORMAT_OPTIONS: readonly { value: FileFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "qti", label: "QTI" },
] as const;

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "대기",
  processing: "처리중",
  completed: "완료",
  failed: "실패",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

/** 폴링 활성 여부 판단 */
function isPollingActive(status: JobStatus | undefined): boolean {
  return status === "pending" || status === "processing";
}

/** 진행률 계산 (0-100) */
function calcPercent(processed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((processed / total) * 100);
}

// --- 상태 배지 컴포넌트 ---

function StatusBadge({ status }: Readonly<{ status: JobStatus }>) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// --- 진행 표시 컴포넌트 ---

function ProgressBar({
  processed,
  total,
}: Readonly<{ processed: number; total: number }>) {
  const percent = calcPercent(processed, total);

  return (
    <div className="flex flex-col gap-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-slate-600">
        {processed} / {total} 건 처리 ({percent}%)
      </p>
    </div>
  );
}

// --- 에러 테이블 컴포넌트 ---

function ErrorReportTable({
  errors,
}: Readonly<{ errors: readonly BulkUploadError[] }>) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-slate-700">
        에러 리포트
      </legend>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-700">행</th>
              <th className="px-3 py-2 font-medium text-slate-700">필드</th>
              <th className="px-3 py-2 font-medium text-slate-700">
                에러 메시지
              </th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err, idx) => (
              <tr
                key={`${err.row}-${err.field ?? ""}-${idx}`}
                className="border-b border-slate-100"
              >
                <td className="px-3 py-2 text-slate-600">{err.row}</td>
                <td className="px-3 py-2 text-slate-600">
                  {err.field ?? "-"}
                </td>
                <td className="px-3 py-2 text-slate-600">{err.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

// --- 메인 페이지 컴포넌트 ---

export default function BulkUploadPage() {
  // -- 폼 상태 --
  const [format, setFormat] = useState<FileFormat>("csv");
  const [fileUrl, setFileUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  // -- 대량 업로드 mutation --
  const bulkUpload = trpc.item.bulkUpload.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
    },
  });

  // -- 업로드 상태 폴링 쿼리 --
  const statusQuery = trpc.item.getBulkUploadStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return isPollingActive(status) ? 2000 : false;
      },
    },
  );

  const jobStatus = statusQuery.data?.status;
  const jobErrors = statusQuery.data?.errors ?? [];

  // -- 업로드 실행 핸들러 --
  const handleUpload = useCallback(() => {
    if (!fileUrl.trim()) return;

    // 이전 작업 상태 초기화
    setJobId(null);

    bulkUpload.mutate({ format, fileUrl: fileUrl.trim() });
  }, [format, fileUrl, bulkUpload]);

  // -- 업로드 버튼 비활성화 조건 --
  const isUploadDisabled =
    !fileUrl.trim() ||
    bulkUpload.isPending ||
    isPollingActive(jobStatus);

  return (
    <div className="mx-auto max-w-3xl">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">대량 업로드</h1>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={"/items" as any}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          취소
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        {/* 업로드 폼 */}
        <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
          <legend className="px-2 text-sm font-semibold text-slate-700">
            파일 업로드
          </legend>
          <div className="mt-2 flex flex-col gap-4">
            {/* 파일 형식 선택 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                파일 형식
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as FileFormat)}
                disabled={bulkUpload.isPending}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 파일 URL 입력 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                파일 URL
              </label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://example.com/items.csv"
                disabled={bulkUpload.isPending}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* 업로드 버튼 */}
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={isUploadDisabled}
                onClick={handleUpload}
              >
                {bulkUpload.isPending ? "업로드 중..." : "업로드"}
              </Button>
            </div>
          </div>
        </fieldset>

        {/* mutation 에러 표시 */}
        {bulkUpload.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{bulkUpload.error.message}</p>
          </div>
        )}

        {/* 진행 상태 섹션 */}
        {jobId && statusQuery.data && (
          <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
            <legend className="px-2 text-sm font-semibold text-slate-700">
              처리 상태
            </legend>
            <div className="mt-2 flex flex-col gap-4">
              <StatusBadge status={statusQuery.data.status} />
              <ProgressBar
                processed={statusQuery.data.processed}
                total={statusQuery.data.total}
              />
            </div>
          </fieldset>
        )}

        {/* 완료 메시지 */}
        {jobStatus === "completed" && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              대량 업로드가 완료되었습니다.
            </p>
          </div>
        )}

        {/* 실패 메시지 */}
        {jobStatus === "failed" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              대량 업로드 처리 중 오류가 발생했습니다.
            </p>
          </div>
        )}

        {/* 폴링 쿼리 에러 표시 */}
        {statusQuery.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              {statusQuery.error.message}
            </p>
          </div>
        )}

        {/* 에러 리포트 테이블 */}
        {jobErrors.length > 0 && <ErrorReportTable errors={jobErrors} />}
      </div>
    </div>
  );
}
