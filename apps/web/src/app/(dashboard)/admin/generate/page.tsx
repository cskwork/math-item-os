"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { PageHelp } from "@/components/help/page-help";
import { TemplateEditor, type TemplateFormData } from "@/components/admin/template-editor";

// --- 상수 ---

const MIN_COUNT = 1;
const MAX_COUNT = 50;
const DEFAULT_COUNT = 5;
const POLL_INTERVAL_MS = 2_000;
const PASS_RATE_THRESHOLD = 0.95;

type ActiveTab = "list" | "new";
type JobStatus = "pending" | "processing" | "completed" | "failed";

// --- 매개변수 오버라이드 타입 ---

interface OverrideParams {
  coefficientRange: [number, number];
  includeFractions: boolean;
  includeNegatives: boolean;
}

const DEFAULT_OVERRIDES: OverrideParams = {
  coefficientRange: [-10, 10],
  includeFractions: false,
  includeNegatives: true,
};

// --- 메인 페이지 ---

export default function GeneratePage() {
  // 탭 및 선택 상태
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // 생성 제어 상태
  const [generationCount, setGenerationCount] = useState(DEFAULT_COUNT);
  const [overrideParams, setOverrideParams] =
    useState<OverrideParams>(DEFAULT_OVERRIDES);
  const [jobId, setJobId] = useState<string | null>(null);

  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const limit = 20;

  // --- tRPC 쿼리 ---

  const templatesQuery = trpc.admin.listTemplates.useQuery({ page, limit });

  const generationResultQuery = trpc.admin.getGenerationResult.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status as JobStatus | undefined;
        if (status === "completed" || status === "failed") {
          return false;
        }
        return POLL_INTERVAL_MS;
      },
    },
  );

  // --- tRPC 뮤테이션 ---

  const createTemplateMutation = trpc.admin.createTemplate.useMutation({
    onSuccess: () => {
      templatesQuery.refetch();
      setActiveTab("list");
      toast.success("템플릿이 저장되었습니다");
    },
    onError: () => {
      toast.error("템플릿 저장에 실패했습니다");
    },
  });

  const generateVariantsMutation = trpc.admin.generateVariants.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast.success("생성 요청이 접수되었습니다");
    },
    onError: () => {
      toast.error("생성 요청에 실패했습니다");
    },
  });

  // --- 핸들러 ---

  const handleSelectTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setJobId(null);
  }, []);

  const handleCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(MIN_COUNT, Math.min(MAX_COUNT, Number(e.target.value)));
      setGenerationCount(value);
    },
    [],
  );

  const handleOverrideChange = useCallback(
    <K extends keyof OverrideParams>(key: K, value: OverrideParams[K]) => {
      setOverrideParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    if (!selectedTemplateId) return;
    generateVariantsMutation.mutate({
      templateId: selectedTemplateId,
      count: generationCount,
      params: {
        coefficientRange: overrideParams.coefficientRange,
        includeFractions: overrideParams.includeFractions,
        includeNegatives: overrideParams.includeNegatives,
      },
    });
  }, [selectedTemplateId, generationCount, overrideParams, generateVariantsMutation]);

  const handleTemplateSave = useCallback(
    (data: TemplateFormData) => {
      // TemplateFormData -> tRPC mutation 입력 타입으로 변환
      createTemplateMutation.mutate({
        title: data.title,
        bodyTemplate: data.bodyTemplate,
        parameters: data.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          min: p.min,
          max: p.max,
          constraints: [...p.constraints],
        })),
        answerTemplate: data.answerTemplate,
        constraints: { ...data.constraints },
      });
    },
    [createTemplateMutation],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // --- 파생 상태 ---

  const templates = templatesQuery.data?.templates ?? [];
  const totalTemplates = templatesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTemplates / limit));

  const generationResult = generationResultQuery.data;
  const jobStatus = generationResult?.status as JobStatus | undefined;
  const isPolling =
    !!jobId && (jobStatus === "pending" || jobStatus === "processing");

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              변형 문항 생성
            </h1>
            <PageHelp pageId="admin-generate" />
          </div>
          <p className="text-sm text-slate-500">
            템플릿을 선택하거나 생성한 후 변형 문항을 생성합니다
          </p>
        </div>
      </div>

      {/* 2-column 레이아웃 */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 왼쪽 패널: 템플릿 관리 */}
        <div className="w-[420px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* 탭 헤더 */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "list"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              템플릿 목록
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "new"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              새 템플릿
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "calc(100% - 45px)" }}>
            {activeTab === "list" && (
              <TemplateListPanel
                templates={templates}
                selectedId={selectedTemplateId}
                isLoading={templatesQuery.isLoading}
                page={page}
                totalPages={totalPages}
                onSelect={handleSelectTemplate}
                onPageChange={handlePageChange}
              />
            )}
            {activeTab === "new" && (
              <div className="flex flex-col gap-3">
                <TemplateEditor
                  onSave={handleTemplateSave}
                />
                {createTemplateMutation.isPending && (
                  <p className="text-sm text-slate-500">저장 중...</p>
                )}
                {createTemplateMutation.isError && (
                  <p className="text-sm text-red-600">
                    저장 실패: {createTemplateMutation.error.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 패널: 생성 제어 및 결과 */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          {selectedTemplateId === null ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">
                왼쪽에서 템플릿을 선택하세요
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* 섹션 1: 생성 제어 */}
              <GenerationControls
                count={generationCount}
                overrideParams={overrideParams}
                isGenerating={generateVariantsMutation.isPending}
                onCountChange={handleCountChange}
                onOverrideChange={handleOverrideChange}
                onGenerate={handleGenerate}
              />

              {generateVariantsMutation.isError && (
                <p className="text-sm text-red-600">
                  생성 요청 실패: {generateVariantsMutation.error.message}
                </p>
              )}

              {/* 섹션 2: 진행 상태 */}
              {isPolling && <GenerationProgress status={jobStatus!} />}

              {/* 섹션 3: 결과 표시 */}
              {generationResult && jobStatus === "completed" && (
                <GenerationResults
                  variants={generationResult.variants}
                  passRate={generationResult.passRate}
                />
              )}

              {jobStatus === "failed" && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">
                    생성 작업 실패
                  </p>
                  <p className="mt-1 text-sm text-red-600">
                    작업이 실패했습니다. 템플릿을 확인하고 다시 시도하세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 템플릿 목록 패널 ---

interface TemplateListItem {
  id: string;
  title: string;
  parameters: unknown;
  _count?: { variants?: number };
}

interface TemplateListPanelProps {
  readonly templates: TemplateListItem[];
  readonly selectedId: string | null;
  readonly isLoading: boolean;
  readonly page: number;
  readonly totalPages: number;
  readonly onSelect: (id: string) => void;
  readonly onPageChange: (page: number) => void;
}

function TemplateListPanel({
  templates,
  selectedId,
  isLoading,
  page,
  totalPages,
  onSelect,
  onPageChange,
}: TemplateListPanelProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-400">템플릿 불러오는 중...</p>;
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        등록된 템플릿이 없습니다. 새 템플릿 탭에서 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 템플릿 카드 목록 */}
      <ul className="flex flex-col gap-2">
        {templates.map((tpl) => {
          const isSelected = tpl.id === selectedId;
          const paramCount = Array.isArray(tpl.parameters)
            ? tpl.parameters.length
            : 0;
          const variantCount = tpl._count?.variants ?? 0;

          return (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => onSelect(tpl.id)}
                className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium text-slate-900">
                  {tpl.title}
                </p>
                <div className="mt-1 flex gap-3 text-xs text-slate-500">
                  <span>매개변수 {paramCount}개</span>
                  <span>변형 {variantCount}건</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// --- 생성 제어 섹션 ---

interface GenerationControlsProps {
  readonly count: number;
  readonly overrideParams: OverrideParams;
  readonly isGenerating: boolean;
  readonly onCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onOverrideChange: <K extends keyof OverrideParams>(
    key: K,
    value: OverrideParams[K],
  ) => void;
  readonly onGenerate: () => void;
}

function GenerationControls({
  count,
  overrideParams,
  isGenerating,
  onCountChange,
  onOverrideChange,
  onGenerate,
}: GenerationControlsProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">생성 설정</h2>

      <div className="mt-3 flex flex-col gap-4">
        {/* 생성 개수 */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="gen-count"
            className="w-24 text-xs font-medium text-slate-600"
          >
            생성 개수
          </label>
          <input
            id="gen-count"
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            onChange={onCountChange}
            className="h-9 w-24 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          />
          <span className="text-xs text-slate-400">({MIN_COUNT}-{MAX_COUNT})</span>
        </div>

        {/* 계수 범위 */}
        <div className="flex items-center gap-3">
          <label className="w-24 text-xs font-medium text-slate-600">
            계수 범위
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={overrideParams.coefficientRange[0]}
              onChange={(e) =>
                onOverrideChange("coefficientRange", [
                  Number(e.target.value),
                  overrideParams.coefficientRange[1],
                ])
              }
              className="h-9 w-20 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="number"
              value={overrideParams.coefficientRange[1]}
              onChange={(e) =>
                onOverrideChange("coefficientRange", [
                  overrideParams.coefficientRange[0],
                  Number(e.target.value),
                ])
              }
              className="h-9 w-20 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>
        </div>

        {/* 분수 포함 여부 */}
        <div className="flex items-center gap-3">
          <label className="w-24 text-xs font-medium text-slate-600">
            분수 포함
          </label>
          <input
            type="checkbox"
            checked={overrideParams.includeFractions}
            onChange={(e) =>
              onOverrideChange("includeFractions", e.target.checked)
            }
            className="h-4 w-4 rounded border-slate-300"
          />
        </div>

        {/* 음수 포함 여부 */}
        <div className="flex items-center gap-3">
          <label className="w-24 text-xs font-medium text-slate-600">
            음수 포함
          </label>
          <input
            type="checkbox"
            checked={overrideParams.includeNegatives}
            onChange={(e) =>
              onOverrideChange("includeNegatives", e.target.checked)
            }
            className="h-4 w-4 rounded border-slate-300"
          />
        </div>

        {/* 생성 버튼 */}
        <button
          type="button"
          disabled={isGenerating}
          onClick={onGenerate}
          className="mt-1 h-9 w-full rounded-md bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? "생성 요청 중..." : "생성 시작"}
        </button>
      </div>
    </section>
  );
}

// --- 생성 진행 상태 ---

interface GenerationProgressProps {
  readonly status: JobStatus;
}

function GenerationProgress({ status }: GenerationProgressProps) {
  const label = status === "pending" ? "대기 중" : "처리 중";

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <p className="text-sm font-medium text-slate-700">
          {label}...
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        2초 간격으로 결과를 확인하고 있습니다
      </p>
    </section>
  );
}

// --- 생성 결과 표시 ---

interface CasVerification {
  passed: boolean;
  answerEquivalence: boolean;
  solutionUniqueness: boolean;
  failureReason?: string;
}

interface VariantResult {
  itemId?: string;
  item?: { id: string; bodyLatex?: string; answerValue?: string; answerLatex?: string };
  bodyLatex?: string;
  params?: Record<string, unknown>;
  answerValue?: string;
  answerLatex?: string;
  casVerification: CasVerification;
}

interface GenerationResultsProps {
  readonly variants: VariantResult[];
  readonly passRate: number;
}

function GenerationResults({ variants, passRate }: GenerationResultsProps) {
  const passPercentage = Math.round(passRate * 100);
  const isBelowThreshold = passRate < PASS_RATE_THRESHOLD;

  return (
    <section className="flex flex-col gap-4">
      {/* 통과율 표시 */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-900">
          CAS 검증 통과율
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isBelowThreshold
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {passPercentage}%
        </span>
      </div>

      {/* Constitution III 경고 */}
      {isBelowThreshold && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            통과율이 95% 미만입니다
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Constitution III 기준에 따라 템플릿 검토가 필요합니다.
            매개변수 또는 제약 조건을 재조정하세요.
          </p>
        </div>
      )}

      {/* 변형 문항 목록 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-700">
          생성된 변형 ({variants.length}건)
        </h3>

        <ul className="flex flex-col gap-2">
          {variants.map((variant, idx) => {
            const id = variant.itemId ?? variant.item?.id ?? `variant-${idx}`;
            const bodyLatex =
              variant.bodyLatex ?? variant.item?.bodyLatex ?? "-";
            const answerValue =
              variant.answerValue ?? variant.item?.answerValue;
            const answerLatex =
              variant.answerLatex ?? variant.item?.answerLatex;
            const cas = variant.casVerification;

            return (
              <li
                key={id}
                className="rounded-md border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* 본문 및 정답 */}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm text-slate-800">
                      <KatexRenderer latex={bodyLatex} displayMode={false} />
                    </p>
                    <div className="mt-1 flex gap-4 text-xs text-slate-500">
                      {answerValue !== undefined && (
                        <span>정답값: {answerValue}</span>
                      )}
                      {answerLatex && (
                        <span className="font-mono">LaTeX: {answerLatex}</span>
                      )}
                    </div>
                  </div>

                  {/* CAS 검증 배지 */}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      cas.passed
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {cas.passed ? "통과" : "실패"}
                  </span>
                </div>

                {/* 실패 사유 */}
                {!cas.passed && cas.failureReason && (
                  <p className="mt-2 text-xs text-red-600">
                    사유: {cas.failureReason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
