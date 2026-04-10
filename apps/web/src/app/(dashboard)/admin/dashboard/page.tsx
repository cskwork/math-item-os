"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { PageHelp } from "@/components/help/page-help";

// --- 타입 ---

interface ActivityEntry {
  readonly id: string;
  readonly tableName: string;
  readonly action: string;
  readonly performedBy: string;
  readonly createdAt: Date;
}

// --- 상수 ---

const STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: "bg-gray-100 text-gray-800",
  reviewed: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  retired: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "초안",
  reviewed: "검토됨",
  approved: "승인됨",
  retired: "폐기됨",
};

const ACTION_COLORS: Readonly<Record<string, string>> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-emerald-100 text-emerald-800",
  generate: "bg-purple-100 text-purple-800",
};

const ACTION_LABELS: Readonly<Record<string, string>> = {
  create: "생성",
  update: "수정",
  delete: "삭제",
  approve: "승인",
  generate: "생성(자동)",
};

// --- 메인 페이지 ---

export default function AdminDashboardPage() {
  const metricsQuery = trpc.admin.getQualityMetrics.useQuery();

  if (metricsQuery.isLoading) {
    return <LoadingState />;
  }

  if (metricsQuery.isError) {
    return <ErrorState message={metricsQuery.error.message} />;
  }

  const data = metricsQuery.data;
  if (!data) {
    return <ErrorState message="데이터를 불러올 수 없습니다." />;
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 페이지 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            품질 지표 대시보드
          </h1>
          <PageHelp pageId="admin-dashboard" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          문항 품질 현황 및 최근 활동을 확인합니다
        </p>
      </div>

      {/* 상단: KPI 카드 4개 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/items" className="block rounded-lg transition-shadow hover:shadow-md">
          <KpiCard
            title="전체 문항 수"
            value={data.totalItems.toLocaleString()}
            unit="건"
          />
        </Link>
        <Link href="/admin/reviews" className="block rounded-lg transition-shadow hover:shadow-md">
          <KpiCard
            title="검토 대기"
            value={data.pendingReviews.toLocaleString()}
            unit="건"
            highlight={data.pendingReviews > 0}
          />
        </Link>
        <KpiCard
          title="메타데이터 완성도"
          value={`${data.metadataCompleteness}`}
          unit="%"
          highlight={data.metadataCompleteness < 80}
        />
        <KpiCard
          title="CAS 검증 통과율"
          value={`${data.generatedItemPassRate}`}
          unit="%"
          highlight={data.generatedItemPassRate < 95}
        />
      </div>

      {/* 중단: 상태별 분포 + 평균 난이도 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatusDistribution
            byStatus={data.byStatus}
            totalItems={data.totalItems}
          />
        </div>
        <DifficultyCard avgDifficulty={data.avgDifficulty} />
      </div>

      {/* 하단: 최근 활동 테이블 */}
      <RecentActivityTable activities={data.recentActivity} />
    </div>
  );
}

// --- 로딩 상태 ---

function LoadingState() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-slate-100" />
        <p className="text-sm text-slate-500 dark:text-slate-400">대시보드 불러오는 중...</p>
      </div>
    </div>
  );
}

// --- 에러 상태 ---

interface ErrorStateProps {
  readonly message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="rounded-md border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm font-medium text-red-800 dark:text-red-400">
          데이터 로드 실패
        </p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-500">{message}</p>
      </div>
    </div>
  );
}

// --- KPI 카드 ---

interface KpiCardProps {
  readonly title: string;
  readonly value: string;
  readonly unit: string;
  readonly highlight?: boolean;
}

function KpiCard({ title, value, unit, highlight = false }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold ${
            highlight ? "text-amber-600" : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {value}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

// --- 상태별 분포 ---

interface StatusDistributionProps {
  readonly byStatus: Record<string, number>;
  readonly totalItems: number;
}

function StatusDistribution({ byStatus, totalItems }: StatusDistributionProps) {
  const statusKeys = ["draft", "reviewed", "approved", "retired"] as const;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">상태별 분포</h2>

      {/* 상태 바 */}
      {totalItems > 0 && (
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {statusKeys.map((key) => {
            const count = byStatus[key] ?? 0;
            const percentage = (count / totalItems) * 100;
            if (percentage === 0) return null;

            const barColors: Readonly<Record<string, string>> = {
              draft: "bg-gray-400",
              reviewed: "bg-yellow-400",
              approved: "bg-green-500",
              retired: "bg-red-400",
            };

            return (
              <div
                key={key}
                className={`${barColors[key]} transition-all`}
                style={{ width: `${percentage}%` }}
                title={`${STATUS_LABELS[key]}: ${count}건 (${Math.round(percentage)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* 상태 카드 목록 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statusKeys.map((key) => {
          const count = byStatus[key] ?? 0;
          const percentage =
            totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;

          return (
            <div key={key} className="flex flex-col gap-1">
              <span
                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[key]}`}
              >
                {STATUS_LABELS[key]}
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {count.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 평균 난이도 카드 ---

interface DifficultyCardProps {
  readonly avgDifficulty: number;
}

function DifficultyCard({ avgDifficulty }: DifficultyCardProps) {
  const roundedDifficulty = Math.round(avgDifficulty * 10) / 10;
  const maxDifficulty = 5;
  const fillPercentage = (avgDifficulty / maxDifficulty) * 100;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">평균 난이도</h2>

      <div className="mt-4 flex flex-col items-center gap-3">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {roundedDifficulty}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">/ {maxDifficulty}</span>

        {/* 난이도 바 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-700 transition-all dark:bg-slate-400"
            style={{ width: `${fillPercentage}%` }}
          />
        </div>

        {/* 난이도 레벨 레이블 */}
        <div className="flex w-full justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>쉬움</span>
          <span>보통</span>
          <span>어려움</span>
        </div>
      </div>
    </div>
  );
}

// --- 최근 활동 테이블 ---

interface RecentActivityTableProps {
  readonly activities: readonly ActivityEntry[];
}

function RecentActivityTable({ activities }: RecentActivityTableProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">최근 활동</h2>

      {activities.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
          최근 활동 내역이 없습니다.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 pr-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  테이블
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  작업
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  수행자
                </th>
                <th className="pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  일시
                </th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr
                  key={activity.id}
                  className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                >
                  <td className="py-2.5 pr-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {activity.tableName}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <ActionBadge action={activity.action} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {activity.performedBy}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(activity.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- 작업 배지 ---

interface ActionBadgeProps {
  readonly action: string;
}

function ActionBadge({ action }: ActionBadgeProps) {
  const colorClass = ACTION_COLORS[action] ?? "bg-slate-100 text-slate-700";
  const label = ACTION_LABELS[action] ?? action;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

// --- 유틸리티 ---

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
