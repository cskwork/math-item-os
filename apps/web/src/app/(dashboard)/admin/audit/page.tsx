"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { PageHelp } from "@/components/help/page-help";
import type { AuditAction, Prisma } from "@math-item-os/db";

// --- 상수 ---

const DEFAULT_LIMIT = 20;

const TABLE_NAME_OPTIONS = [
  "items", "skills", "standards", "misconceptions",
  "templates", "assignments", "users",
] as const;

const TABLE_NAME_LABELS: Record<string, string> = {
  items: "문항", skills: "스킬", standards: "성취기준",
  misconceptions: "오개념", templates: "템플릿",
  assignments: "과제", users: "사용자",
};

const ACTION_OPTIONS = [
  "create", "update", "delete", "approve",
  "retire", "generate", "assign",
] as const;

const ACTION_LABELS: Record<string, string> = {
  create: "생성", update: "수정", delete: "삭제", approve: "승인",
  retire: "폐기", generate: "생성(변형)", assign: "배정",
};

const ACTION_BADGE_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-emerald-100 text-emerald-800",
  retire: "bg-orange-100 text-orange-800",
  generate: "bg-purple-100 text-purple-800",
  assign: "bg-indigo-100 text-indigo-800",
};

// --- 필터 타입 ---

interface Filters {
  readonly tableName: string;
  readonly action: AuditAction | "";
  readonly dateFrom: string;
  readonly dateTo: string;
}

const INITIAL_FILTERS: Filters = {
  tableName: "", action: "", dateFrom: "", dateTo: "",
};

// --- 유틸리티 ---

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

// --- 메인 페이지 ---

export default function AuditLogPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = DEFAULT_LIMIT;

  const logsQuery = trpc.admin.listAuditLogs.useQuery({
    page,
    limit,
    tableName: filters.tableName || undefined,
    action: filters.action || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

  const handleFilterChange = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  }, []);

  const handleToggleExpand = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setExpandedId(null);
  }, []);

  const logs: AuditLogEntry[] = logsQuery.data?.logs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">감사 로그</h1>
          <PageHelp pageId="admin-audit" />
        </div>
        <p className="text-sm text-slate-500">시스템 변경 내역을 조회합니다</p>
      </div>

      {/* 필터 바 */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* 로그 테이블 */}
      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="h-full overflow-y-auto">
          {logsQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">불러오는 중...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">조건에 맞는 로그가 없습니다</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-slate-600">일시</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">작업</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">테이블</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">레코드 ID</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">수행자</th>
                  <th className="w-16 px-4 py-2.5 font-medium text-slate-600">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    isExpanded={expandedId === log.id}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 에러 표시 */}
      {logsQuery.isError && (
        <p className="text-sm text-red-600">
          로그 조회 실패: {logsQuery.error.message}
        </p>
      )}

      {/* 페이지네이션 */}
      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={handlePageChange} />
    </div>
  );
}

// --- 필터 바 ---

interface FilterBarProps {
  readonly filters: Filters;
  readonly onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  readonly onReset: () => void;
}

function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  const selectClass = "h-9 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">테이블</label>
        <select value={filters.tableName} onChange={(e) => onFilterChange("tableName", e.target.value)} className={selectClass}>
          <option value="">전체</option>
          {TABLE_NAME_OPTIONS.map((name) => (
            <option key={name} value={name}>{TABLE_NAME_LABELS[name] ?? name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">작업</label>
        <select value={filters.action} onChange={(e) => onFilterChange("action", e.target.value as Filters["action"])} className={selectClass}>
          <option value="">전체</option>
          {ACTION_OPTIONS.map((action) => (
            <option key={action} value={action}>{ACTION_LABELS[action] ?? action}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">시작일</label>
        <input type="date" value={filters.dateFrom} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className={selectClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">종료일</label>
        <input type="date" value={filters.dateTo} onChange={(e) => onFilterChange("dateTo", e.target.value)} className={selectClass} />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
      >
        초기화
      </button>
    </div>
  );
}

// --- 로그 행 ---

interface AuditLogEntry {
  readonly id: string;
  readonly orgId: string;
  readonly tableName: string;
  readonly recordId: string;
  readonly action: AuditAction;
  readonly oldData: Prisma.JsonValue | null;
  readonly newData: Prisma.JsonValue | null;
  readonly performedBy: string;
  readonly createdAt: Date;
}

interface LogRowProps {
  readonly log: AuditLogEntry;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (id: string) => void;
}

function LogRow({ log, isExpanded, onToggleExpand }: LogRowProps) {
  const badgeColor = ACTION_BADGE_COLORS[log.action] ?? "bg-gray-100 text-gray-800";

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatDateTime(log.createdAt)}</td>
        <td className="px-4 py-2.5">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
            {ACTION_LABELS[log.action] ?? log.action}
          </span>
        </td>
        <td className="px-4 py-2.5 text-slate-700">{TABLE_NAME_LABELS[log.tableName] ?? log.tableName}</td>
        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{truncateId(log.recordId)}</td>
        <td className="px-4 py-2.5 text-slate-700">{log.performedBy}</td>
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => onToggleExpand(log.id)}
            className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {isExpanded ? "접기" : "펼치기"}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-4 py-3">
            <LogDetail oldData={log.oldData} newData={log.newData} />
          </td>
        </tr>
      )}
    </>
  );
}

// --- 로그 상세 (JSON 뷰) ---

interface LogDetailProps {
  readonly oldData: Prisma.JsonValue | null;
  readonly newData: Prisma.JsonValue | null;
}

function LogDetail({ oldData, newData }: LogDetailProps) {
  const preClass = "max-h-60 overflow-auto rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">변경 전 (oldData)</p>
        <pre className={preClass}>{oldData ? JSON.stringify(oldData, null, 2) : "(없음)"}</pre>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">변경 후 (newData)</p>
        <pre className={preClass}>{newData ? JSON.stringify(newData, null, 2) : "(없음)"}</pre>
      </div>
    </div>
  );
}

// --- 페이지네이션 ---

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const btnClass = "rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-500">전체 {total}건</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={btnClass}>
          이전
        </button>
        <span className="text-xs text-slate-500">{page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={btnClass}>
          다음
        </button>
      </div>
    </div>
  );
}
