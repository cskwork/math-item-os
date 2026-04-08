"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 20;

const PURPOSE_LABELS: Readonly<Record<string, string>> = {
  diagnosis: "진단평가",
  remediation: "보충학습",
  pre_exam: "시험대비",
  advanced: "심화학습",
};

const PURPOSE_OPTIONS = [
  { value: undefined, label: "전체" },
  { value: "diagnosis", label: "진단평가" },
  { value: "remediation", label: "보충학습" },
  { value: "pre_exam", label: "시험대비" },
  { value: "advanced", label: "심화학습" },
] as const;

type PurposeFilter = (typeof PURPOSE_OPTIONS)[number]["value"];

export default function AssignmentsPage() {
  const [page, setPage] = useState(1);
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>(undefined);

  const { data, isLoading } = trpc.admin.listAssignments.useQuery({
    page,
    limit: PAGE_LIMIT,
    purpose: purposeFilter,
  });

  const assignments = data?.assignments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">학습지 관리</h1>
            <PageHelp pageId="admin-assignments" />
          </div>
          <p className="text-sm text-slate-500">
            {total}건의 학습지
          </p>
        </div>
        <Link href="/admin/assignments/new">
          <Button size="sm">학습지 제작</Button>
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {PURPOSE_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              setPurposeFilter(option.value);
              setPage(1);
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              purposeFilter === option.value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">
          불러오는 중...
        </p>
      ) : assignments.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          학습지가 없습니다
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  제목
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  목적
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  문항 수
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  생성일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/assignments/${a.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {PURPOSE_LABELS[a.purpose] ?? a.purpose}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {a._count?.items ?? a.items?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
