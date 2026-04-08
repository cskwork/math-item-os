"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trpc } from "@/lib/trpc";
import { BLOOM_LEVEL, BLOOM_LEVEL_OPTIONS } from "@math-item-os/shared/constants/index";
import { SkillFormModal, INITIAL_FORM } from "./_components/skill-form-modal";
import type { SkillFormData } from "./_components/skill-form-modal";

// --- 기본값 ---

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// --- 필터 상태 타입 ---

interface Filters {
  readonly topicPath: string;
  readonly bloomLevel: string;
}

const INITIAL_FILTERS: Filters = { topicPath: "", bloomLevel: "" };

// --- Bloom 수준 라벨 조회 ---

function getBloomLabel(level: number | null | undefined): string {
  if (level == null) return "-";
  const entry = BLOOM_LEVEL[level as keyof typeof BLOOM_LEVEL];
  return entry ? `${level}. ${entry.label}` : String(level);
}

// --- 필터 셀렉트 컴포넌트 ---

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "전체",
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  placeholder?: string;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- 로딩 스켈레톤 ---

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-4 rounded-md border border-slate-200 bg-white p-3">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-4 w-16 rounded bg-slate-200" />
          <div className="h-4 w-12 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

// --- 빈 상태 ---

function EmptyState({ onCreateClick }: Readonly<{ onCreateClick: () => void }>) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-16">
      <p className="text-sm text-slate-500">등록된 스킬이 없습니다</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onCreateClick}>
        새 스킬 추가
      </Button>
    </div>
  );
}

// --- 에러 상태 ---

function ErrorState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

// --- 페이지네이션 ---

function Pagination({
  page,
  totalPages,
  onPageChange,
}: Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}>) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      <span className="text-sm text-slate-600">
        {page} / {totalPages} 페이지
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}

// --- 메인 페이지 ---

export default function SkillListPage() {
  // -- 필터 상태 --
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(DEFAULT_PAGE);

  // -- 모달 상태 --
  const [formModal, setFormModal] = useState<{
    readonly open: boolean;
    readonly mode: "create" | "edit";
    readonly editingId: string | null;
    readonly initialData: SkillFormData;
  }>({ open: false, mode: "create", editingId: null, initialData: INITIAL_FORM });

  const [deleteTarget, setDeleteTarget] = useState<{
    readonly id: string;
    readonly title: string;
  } | null>(null);

  const [formError, setFormError] = useState("");

  // -- 필터 변경 핸들러 --
  const handleFilterChange = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(DEFAULT_PAGE);
    },
    [],
  );

  // -- tRPC 쿼리 입력값 구성 --
  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = { page, limit: DEFAULT_LIMIT };
    if (filters.topicPath) input.topicPath = filters.topicPath;
    if (filters.bloomLevel) input.bloomLevel = Number(filters.bloomLevel);
    return input;
  }, [filters, page]);

  // -- 스킬 목록 조회 --
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading, isError, error } = trpc.skill.list.useQuery(queryInput as any);

  // -- 뮤테이션 --
  const utils = trpc.useUtils();

  const createMutation = trpc.skill.create.useMutation({
    onSuccess: () => {
      utils.skill.list.invalidate();
      setFormModal({ open: false, mode: "create", editingId: null, initialData: INITIAL_FORM });
      setFormError("");
      toast.success("스킬이 추가되었습니다");
    },
    onError: (err) => {
      setFormError(err.message);
      toast.error("스킬 처리에 실패했습니다");
    },
  });

  const updateMutation = trpc.skill.update.useMutation({
    onSuccess: () => {
      utils.skill.list.invalidate();
      setFormModal({ open: false, mode: "create", editingId: null, initialData: INITIAL_FORM });
      setFormError("");
      toast.success("스킬이 수정되었습니다");
    },
    onError: (err) => {
      setFormError(err.message);
      toast.error("스킬 처리에 실패했습니다");
    },
  });

  const deleteMutation = trpc.skill.delete.useMutation({
    onSuccess: () => {
      utils.skill.list.invalidate();
      setDeleteTarget(null);
      toast.success("스킬이 삭제되었습니다");
    },
    onError: () => {
      toast.error("스킬 처리에 실패했습니다");
    },
  });

  // -- 생성 모달 열기 --
  const handleOpenCreate = useCallback(() => {
    setFormError("");
    setFormModal({ open: true, mode: "create", editingId: null, initialData: INITIAL_FORM });
  }, []);

  // -- 수정 모달 열기 --
  const handleOpenEdit = useCallback(
    (skill: {
      id: string;
      code: string;
      title: string;
      topicPath: string;
      bloomLevel?: number | null;
      estimatedTimeMin?: number | null;
      description?: string | null;
    }) => {
      setFormError("");
      setFormModal({
        open: true,
        mode: "edit",
        editingId: skill.id,
        initialData: {
          code: skill.code,
          title: skill.title,
          description: skill.description ?? "",
          topicPath: skill.topicPath,
          bloomLevel: skill.bloomLevel != null ? String(skill.bloomLevel) : "",
          estimatedTimeMin: skill.estimatedTimeMin != null ? String(skill.estimatedTimeMin) : "",
        },
      });
    },
    [],
  );

  // -- 모달 닫기 --
  const handleCloseModal = useCallback(() => {
    setFormModal({ open: false, mode: "create", editingId: null, initialData: INITIAL_FORM });
    setFormError("");
  }, []);

  // -- 폼 제출 --
  const handleFormSubmit = useCallback(
    (formData: SkillFormData) => {
      if (formModal.mode === "create") {
        createMutation.mutate({
          code: formData.code,
          title: formData.title,
          description: formData.description || undefined,
          topicPath: formData.topicPath,
          bloomLevel: formData.bloomLevel ? Number(formData.bloomLevel) : undefined,
          estimatedTimeMin: formData.estimatedTimeMin ? Number(formData.estimatedTimeMin) : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } else if (formModal.editingId) {
        updateMutation.mutate({
          id: formModal.editingId,
          title: formData.title,
          description: formData.description || undefined,
          topicPath: formData.topicPath || undefined,
          bloomLevel: formData.bloomLevel ? Number(formData.bloomLevel) : undefined,
          estimatedTimeMin: formData.estimatedTimeMin ? Number(formData.estimatedTimeMin) : undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    },
    [formModal.mode, formModal.editingId, createMutation, updateMutation],
  );

  // -- 삭제 확인 --
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteMutation.mutate({ id: deleteTarget.id } as any);
  }, [deleteTarget, deleteMutation]);

  // -- 전체 페이지 수 계산 --
  const totalPages = data ? Math.ceil(data.total / DEFAULT_LIMIT) : 0;

  // -- 필터 초기화 --
  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setPage(DEFAULT_PAGE);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return filters.topicPath !== "" || filters.bloomLevel !== "";
  }, [filters]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">스킬 관리</h1>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={"/skills/graph" as any}>
            <Button variant="outline">그래프 보기</Button>
          </Link>
          <Button onClick={handleOpenCreate}>새 스킬 추가</Button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* 분류 경로 필터 (텍스트 입력) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">분류 경로</label>
            <input
              type="text"
              value={filters.topicPath}
              onChange={(e) => handleFilterChange("topicPath", e.target.value)}
              placeholder="예: math.algebra"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>

          <FilterSelect
            label="Bloom 수준"
            value={filters.bloomLevel}
            onChange={(v) => handleFilterChange("bloomLevel", v)}
            options={BLOOM_LEVEL_OPTIONS}
          />
        </div>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              필터 초기화
            </Button>
          </div>
        )}
      </div>

      {/* 결과 영역 */}
      {isLoading && <TableSkeleton />}

      {isError && (
        <ErrorState
          message={error?.message ?? "스킬 목록을 불러오는 중 오류가 발생했습니다."}
        />
      )}

      {!isLoading && !isError && data && data.skills.length === 0 && <EmptyState onCreateClick={handleOpenCreate} />}

      {!isLoading && !isError && data && data.skills.length > 0 && (
        <>
          {/* 결과 건수 */}
          <p className="mb-3 text-sm text-slate-500">총 {data.total}건</p>

          {/* 스킬 테이블 */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">코드</th>
                  <th className="px-4 py-3 font-medium text-slate-600">스킬명</th>
                  <th className="px-4 py-3 font-medium text-slate-600">분류 경로</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Bloom 수준</th>
                  <th className="px-4 py-3 font-medium text-slate-600">문항 수</th>
                  <th className="px-4 py-3 font-medium text-slate-600">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.skills.map((skill: any) => (
                  <tr key={skill.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                      {skill.code}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{skill.title}</td>
                    <td className="px-4 py-3 text-slate-600">{skill.topicPath}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {getBloomLabel(skill.bloomLevel)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {skill._count?.items ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(skill)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteTarget({ id: skill.id, title: skill.title })}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <SkillFormModal
        open={formModal.open}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
        }}
        mode={formModal.mode}
        initialData={formModal.initialData}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="스킬 삭제"
        description={
          deleteTarget
            ? `\u201C${deleteTarget.title}\u201D 스킬을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
            : ""
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
