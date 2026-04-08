"use client";

import { useState, useCallback } from "react";

import { trpc } from "@/lib/trpc";
import { PageHelp } from "@/components/help/page-help";

// --- 상수 ---
const DEFAULT_PAGE = 1;
const PAGE_LIMIT = 20;
const ROLE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "admin", label: "관리자" },
  { value: "reviewer", label: "검수자" },
  { value: "teacher", label: "교사" },
] as const;

type UserRole = "admin" | "reviewer" | "teacher";
type RoleFilter = UserRole | "all";
const ROLE_LABEL_MAP: Record<UserRole, string> = {
  admin: "관리자",
  reviewer: "검수자",
  teacher: "교사",
};
const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-800",
  reviewer: "bg-blue-100 text-blue-800",
  teacher: "bg-green-100 text-green-800",
};

// --- 사용자 타입 ---
interface UserResult {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
  readonly role: string;
  readonly image: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// --- 날짜 포맷 유틸 ---
function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- 메인 페이지 ---
export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(DEFAULT_PAGE);

  // --- tRPC 쿼리 ---
  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    limit: PAGE_LIMIT,
    role: roleFilter === "all" ? undefined : roleFilter,
  });

  // --- tRPC 뮤테이션 ---
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
    },
  });

  // --- 핸들러 ---
  const handleRoleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRoleFilter(e.target.value as RoleFilter);
      setPage(DEFAULT_PAGE);
    },
    [],
  );

  const handleRoleChange = useCallback(
    (userId: string, newRole: UserRole) => {
      updateRoleMutation.mutate({ userId, role: newRole });
    },
    [updateRoleMutation],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // --- 파생 상태 ---
  const users: readonly UserResult[] = usersQuery.data?.users ?? [];
  const totalUsers = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_LIMIT));

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              사용자 관리
            </h1>
            <PageHelp pageId="admin-users" />
          </div>
          <p className="text-sm text-slate-500">
            총 {totalUsers}명
          </p>
        </div>

        {/* 역할 필터 */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="role-filter"
            className="text-xs font-medium text-slate-600"
          >
            역할 필터
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={handleRoleFilterChange}
            className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 뮤테이션 에러 */}
      {updateRoleMutation.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">
            역할 변경 실패: {updateRoleMutation.error.message}
          </p>
        </div>
      )}

      {/* 사용자 테이블 */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-slate-400">사용자 목록을 불러오는 중...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-slate-400">해당 조건의 사용자가 없습니다</p>
          </div>
        ) : (
          <UserTable
            users={users}
            mutatingUserId={
              updateRoleMutation.isPending
                ? updateRoleMutation.variables?.userId ?? null
                : null
            }
            onRoleChange={handleRoleChange}
          />
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

// --- 사용자 테이블 ---
interface UserTableProps {
  readonly users: readonly UserResult[];
  readonly mutatingUserId: string | null;
  readonly onRoleChange: (userId: string, role: UserRole) => void;
}

function UserTable({ users, mutatingUserId, onRoleChange }: UserTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            이름
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            이메일
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            역할
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            가입일
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
            역할 변경
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isMutating={mutatingUserId === user.id}
            onRoleChange={onRoleChange}
          />
        ))}
      </tbody>
    </table>
  );
}

// --- 사용자 행 ---
interface UserRowProps {
  readonly user: UserResult;
  readonly isMutating: boolean;
  readonly onRoleChange: (userId: string, role: UserRole) => void;
}

function UserRow({ user, isMutating, onRoleChange }: UserRowProps) {
  const role = user.role as UserRole;
  const displayName = user.name ?? user.email;
  const badgeStyle = ROLE_BADGE_STYLE[role] ?? "bg-slate-100 text-slate-800";
  const roleLabel = ROLE_LABEL_MAP[role] ?? user.role;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRole = e.target.value as UserRole;
      if (newRole !== role) {
        onRoleChange(user.id, newRole);
      }
    },
    [user.id, role, onRoleChange],
  );

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 text-slate-900">{displayName}</td>
      <td className="px-4 py-3 text-slate-600">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}
        >
          {roleLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          disabled={isMutating}
          onChange={handleChange}
          className="h-8 rounded-md border border-slate-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="admin">{ROLE_LABEL_MAP.admin}</option>
          <option value="reviewer">{ROLE_LABEL_MAP.reviewer}</option>
          <option value="teacher">{ROLE_LABEL_MAP.teacher}</option>
        </select>
      </td>
    </tr>
  );
}

// --- 페이지네이션 컨트롤 ---
interface PaginationControlsProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
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
        onClick={() => onPageChange(page + 1)}
        className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}
