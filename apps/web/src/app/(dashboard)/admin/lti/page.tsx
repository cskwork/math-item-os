"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

// --- 타입 ---

interface LtiPlatformResult {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly authEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksEndpoint: string;
  readonly deploymentId: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

// --- 메인 페이지 ---

export default function LtiPlatformsPage() {
  const [showForm, setShowForm] = useState(false);

  // 폼 상태
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [authEndpoint, setAuthEndpoint] = useState("");
  const [tokenEndpoint, setTokenEndpoint] = useState("");
  const [jwksEndpoint, setJwksEndpoint] = useState("");
  const [deploymentId, setDeploymentId] = useState("");

  // 데이터 조회
  const {
    data: platforms,
    isLoading,
    refetch,
  } = trpc.admin.listLtiPlatforms.useQuery();

  // 등록 뮤테이션
  const registerMutation = trpc.admin.registerLtiPlatform.useMutation({
    onSuccess: () => {
      toast.success("LTI 플랫폼이 등록되었습니다");
      resetForm();
      void refetch();
    },
    onError: (err) => {
      toast.error(`등록 실패: ${err.message}`);
    },
  });

  // 활성/비활성 토글
  const toggleMutation = trpc.admin.toggleLtiPlatform.useMutation({
    onSuccess: () => {
      toast.success("플랫폼 상태가 변경되었습니다");
      void refetch();
    },
    onError: (err) => {
      toast.error(`상태 변경 실패: ${err.message}`);
    },
  });

  const resetForm = useCallback(() => {
    setShowForm(false);
    setName("");
    setIssuer("");
    setClientId("");
    setAuthEndpoint("");
    setTokenEndpoint("");
    setJwksEndpoint("");
    setDeploymentId("");
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      registerMutation.mutate({
        name,
        issuer,
        clientId,
        authEndpoint,
        tokenEndpoint,
        jwksEndpoint,
        deploymentId: deploymentId || undefined,
      });
    },
    [name, issuer, clientId, authEndpoint, tokenEndpoint, jwksEndpoint, deploymentId, registerMutation],
  );

  const handleToggle = useCallback(
    (platformId: string) => {
      toggleMutation.mutate({ platformId });
    },
    [toggleMutation],
  );

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            LTI 1.3 플랫폼 관리
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            외부 LMS 플랫폼을 등록하고 관리합니다.
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? "취소" : "플랫폼 추가"}
        </Button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
            새 플랫폼 등록
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="이름" value={name} onChange={setName} required />
            <FormField label="Issuer URL" value={issuer} onChange={setIssuer} type="url" required />
            <FormField label="Client ID" value={clientId} onChange={setClientId} required />
            <FormField label="Auth Endpoint" value={authEndpoint} onChange={setAuthEndpoint} type="url" required />
            <FormField label="Token Endpoint" value={tokenEndpoint} onChange={setTokenEndpoint} type="url" required />
            <FormField label="JWKS Endpoint" value={jwksEndpoint} onChange={setJwksEndpoint} type="url" required />
            <FormField label="Deployment ID (선택)" value={deploymentId} onChange={setDeploymentId} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" size="sm" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "등록 중..." : "등록"}
            </Button>
          </div>
        </form>
      )}

      {/* 플랫폼 테이블 */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-slate-400 dark:text-slate-500">불러오는 중...</p>
          </div>
        ) : !platforms || platforms.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-slate-400 dark:text-slate-500">등록된 플랫폼이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">Issuer</th>
                  <th className="px-4 py-3 font-medium">Client ID</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">등록일</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p: LtiPlatformResult) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <span className="max-w-[200px] truncate block">{p.issuer}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {p.clientId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {p.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() => handleToggle(p.id)}
                      >
                        {p.isActive ? "비활성화" : "활성화"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 날짜 포맷 유틸 ---

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- 폼 필드 컴포넌트 ---

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly type?: string;
  readonly required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );
}
