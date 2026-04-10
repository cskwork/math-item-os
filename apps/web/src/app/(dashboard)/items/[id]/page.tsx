"use client";

import { use, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { SimilarItemsPanel } from "@/components/search/similar-items-panel";
import { ReviewSuggestions } from "@/components/items/review-suggestions";
import {
  QUALITY_STATUS,
  ITEM_TYPE,
  SCHOOL_LEVEL,
  DIFFICULTY_LEVEL,
  FORMULA_TYPE,
  ANSWER_FORMAT,
  USAGE_PURPOSE,
  SOLUTION_METHOD,
  type QualityStatusKey,
  type ItemTypeKey,
  type SchoolLevelKey,
  type DifficultyLevelKey,
  type FormulaTypeKey,
  type AnswerFormatKey,
  type UsagePurposeKey,
  type SolutionMethodKey,
} from "@math-item-os/shared/constants/index";

// ─── XML 다운로드 유틸 ───

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 상태 전이 맵 (quality-status.service.ts VALID_TRANSITIONS 미러) ───

const VALID_TRANSITIONS: Record<QualityStatusKey, readonly QualityStatusKey[]> = {
  draft: ["reviewed"],
  reviewed: ["approved"],
  approved: ["retired", "draft"],
  retired: [],
} as const;

// ─── 상태 배지 색상 매핑 ───

const STATUS_COLOR_MAP: Record<QualityStatusKey, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  reviewed: "bg-blue-100 text-blue-700 border-blue-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  retired: "bg-red-100 text-red-700 border-red-300",
} as const;

// ─── 날짜 포맷 ───

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumberish(value: number | { toString(): string }): string {
  return typeof value === "number" ? String(value) : value.toString();
}

interface ParsedSolutionStep {
  readonly stepNum: number;
  readonly latex: string;
  readonly explanation: string;
}

function parseSolutionSteps(input: unknown): ParsedSolutionStep[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((step) => {
    if (
      step == null ||
      typeof step !== "object" ||
      typeof step.stepNum !== "number" ||
      typeof step.latex !== "string" ||
      typeof step.explanation !== "string"
    ) {
      return [];
    }

    return [
      {
        stepNum: step.stepNum,
        latex: step.latex,
        explanation: step.explanation,
      },
    ];
  });
}

// ─── 학교급 + 학년 라벨 ───

function formatSchoolGrade(schoolLevel: string, grade: number): string {
  const level = SCHOOL_LEVEL[schoolLevel as SchoolLevelKey];
  if (!level) return `${schoolLevel} ${grade}학년`;
  return `${level.label} ${grade}학년`;
}

// ─── 메타 배지 컴포넌트 ───

function MetaBadge({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── 섹션 컴포넌트 ───

function Section({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

// ─── 접기/펼치기 섹션 ───

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
        <span className="text-xs text-slate-400">{isOpen ? "접기" : "펼치기"}</span>
      </button>
      {isOpen && <div className="border-t border-slate-100 p-5 pt-4 dark:border-slate-700">{children}</div>}
    </section>
  );
}

// ─── 정보 행 컴포넌트 ───

function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <dt className="w-28 shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

// ─── 코드 블록 컴포넌트 ───

function CodeBlock({
  content,
  label,
}: {
  readonly content: string;
  readonly label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      )}
      <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <code>{content}</code>
      </pre>
    </div>
  );
}

// ─── 메인 페이지 컴포넌트 ───

export default function ItemDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  // Next.js 15: params는 Promise이므로 use()로 unwrap
  const { id } = use(params);

  // 선택된 버전의 LaTeX (null이면 현재 버전 표시)
  const [selectedVersionLatex, setSelectedVersionLatex] = useState<string | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  // QTI 내보내기 상태
  const [qtiExportEnabled, setQtiExportEnabled] = useState(false);

  // tRPC 쿼리
  const {
    data: item,
    isLoading,
    error,
    refetch,
  } = trpc.item.getById.useQuery({ id });

  // QTI 내보내기 쿼리
  const qtiExport = trpc.item.exportQti.useQuery(
    { itemId: id },
    {
      enabled: qtiExportEnabled,
      retry: false,
    },
  );

  // QTI 다운로드 핸들러
  const handleExportQti = useCallback(() => {
    if (qtiExport.data) {
      downloadXml(qtiExport.data.xml, `item-${id}.xml`);
    } else {
      setQtiExportEnabled(true);
    }
  }, [qtiExport.data, id]);

  // 쿼리 결과가 오면 자동 다운로드
  useEffect(() => {
    if (qtiExportEnabled && qtiExport.data) {
      downloadXml(qtiExport.data.xml, `item-${id}.xml`);
      setQtiExportEnabled(false);
    }
  }, [qtiExportEnabled, qtiExport.data, id]);

  // 상태 전이 뮤테이션
  const updateStatus = trpc.item.updateStatus.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // 상태 전이 핸들러
  const handleStatusTransition = useCallback(
    (newStatus: QualityStatusKey) => {
      updateStatus.mutate({ id, status: newStatus });
    },
    [id, updateStatus],
  );

  // 버전 선택 핸들러
  const handleVersionSelect = useCallback(
    (version: number, latex: string) => {
      if (selectedVersionNum === version) {
        // 이미 선택된 버전이면 해제 (현재 버전으로 복귀)
        setSelectedVersionLatex(null);
        setSelectedVersionNum(null);
      } else {
        setSelectedVersionLatex(latex);
        setSelectedVersionNum(version);
      }
    },
    [selectedVersionNum],
  );

  // ─── 로딩 상태 ───

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">문항 데이터를 불러오는 중...</p>
      </div>
    );
  }

  // ─── 에러 상태 ───

  if (error || !item) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">
          {error?.message ?? "문항을 찾을 수 없습니다."}
        </p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={"/items" as any}>
          <Button variant="outline" size="sm">
            목록으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  // ─── 데이터 파생 ───

  const statusKey = item.status as QualityStatusKey;
  const statusLabel = QUALITY_STATUS[statusKey]?.label ?? item.status;
  const statusColor = STATUS_COLOR_MAP[statusKey] ?? STATUS_COLOR_MAP.draft;
  const nextStatuses = VALID_TRANSITIONS[statusKey] ?? [];

  const itemTypeLabel =
    ITEM_TYPE[item.itemType as ItemTypeKey]?.label ?? item.itemType;
  const formulaTypeLabel =
    FORMULA_TYPE[item.formulaType as FormulaTypeKey]?.label ?? item.formulaType;
  const answerFormatLabel =
    ANSWER_FORMAT[item.answerFormat as AnswerFormatKey]?.label ?? item.answerFormat;
  const difficultyLabel =
    item.difficultyAuthor != null
      ? DIFFICULTY_LEVEL[item.difficultyAuthor as DifficultyLevelKey]?.label ?? String(item.difficultyAuthor)
      : "-";

  // 표시할 LaTeX (선택된 버전 또는 현재 버전)
  const displayLatex = selectedVersionLatex ?? item.bodyLatex;

  // 관계 데이터 추출 (Prisma include 결과에서 중간 테이블 풀기)
  const skills = item.skills?.map((rel: { skill: { id: string; code: string; title: string; topicPath: string } }) => rel.skill) ?? [];
  const standards = item.standards?.map((rel: { standard: { id: string; code: string; title: string } }) => rel.standard) ?? [];
  const misconceptions = item.misconceptions?.map((rel: { misconception: { id: string; code: string; title: string } }) => rel.misconception) ?? [];
  const solutions = item.solutions ?? [];
  const difficultyProfile = item.difficultyProfile ?? null;
  const versions = item.versions ?? [];

  // 정답 표시 (수식 형식이면 KaTeX 렌더링)
  const answerValue =
    typeof item.answer === "object" && item.answer !== null
      ? (item.answer as { value?: string }).value ?? JSON.stringify(item.answer)
      : String(item.answer);

  const answerDisplay =
    item.answerFormat === "expression" ? (
      <KatexRenderer latex={answerValue} displayMode={false} className="text-sm" />
    ) : (
      answerValue
    );

  // 활용 목적 라벨
  const usagePurposeLabels = (item.usagePurposes ?? []).map(
    (p: string) => USAGE_PURPOSE[p as UsagePurposeKey]?.label ?? p,
  );

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* ─── 헤더 ─── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link
            href={"/items" as any}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          >
            &larr; 목록
          </Link>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              statusColor,
            )}
          >
            {statusLabel}
          </span>
          <span className="text-xs text-slate-400">v{item.currentVersion}</span>
          {item.isGenerated && (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
              AI 생성
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 상태 전이 버튼 */}
          {nextStatuses.map((nextStatus) => {
            const nextLabel =
              QUALITY_STATUS[nextStatus as QualityStatusKey]?.label ?? nextStatus;
            return (
              <Button
                key={nextStatus}
                variant="outline"
                size="sm"
                disabled={updateStatus.isPending}
                onClick={() => handleStatusTransition(nextStatus)}
              >
                {nextLabel}(으)로 전환
              </Button>
            );
          })}
          {/* QTI 내보내기 버튼 */}
          <Button
            variant="outline"
            size="sm"
            disabled={qtiExport.isLoading}
            onClick={handleExportQti}
          >
            {qtiExport.isLoading ? "내보내기 중..." : "QTI 내보내기"}
          </Button>
          {/* 수정 버튼 */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={`/items/new?edit=${item.id}` as any}>
            <Button variant="secondary" size="sm">
              수정
            </Button>
          </Link>
        </div>
      </div>

      {/* 상태 전이 에러 표시 */}
      {updateStatus.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-400">{updateStatus.error.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* ─── 1. 수식 표시 영역 ─── */}
        <Section title="수식 표시 영역">
          {selectedVersionNum != null && (
            <p className="mb-3 text-xs text-amber-600">
              v{selectedVersionNum} 버전의 수식을 표시 중입니다.
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  setSelectedVersionLatex(null);
                  setSelectedVersionNum(null);
                }}
              >
                현재 버전으로 복귀
              </button>
            </p>
          )}
          {/* 렌더링된 수식 */}
          <div className="flex min-h-[80px] items-center justify-center rounded-md border border-slate-100 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
            <KatexRenderer
              latex={displayLatex}
              displayMode={true}
              className="text-lg text-slate-900 dark:text-slate-100"
            />
          </div>
          {/* LaTeX 원본 코드 (접기/펼치기) */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
              LaTeX 원본 코드
            </summary>
            <div className="mt-2">
              <CodeBlock content={displayLatex} />
            </div>
          </details>
        </Section>

        {/* ─── AI 자동 검토 ─── */}
        <ReviewSuggestions itemId={id} />

        {/* ─── 2. 기본 정보 패널 ─── */}
        <Section title="기본 정보">
          <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <InfoRow label="학교급/학년">
              {formatSchoolGrade(item.schoolLevel, item.grade)}
              {item.semester && (
                <span className="ml-1 text-slate-500">
                  / {item.semester === "first" ? "1학기" : "2학기"}
                </span>
              )}
            </InfoRow>
            <InfoRow label="문항 유형">{itemTypeLabel}</InfoRow>
            <InfoRow label="수식 유형">{formulaTypeLabel}</InfoRow>
            <InfoRow label="정답 형식">{answerFormatLabel}</InfoRow>
            <InfoRow label="정답">{answerDisplay}</InfoRow>
            <InfoRow label="난이도">{difficultyLabel}</InfoRow>
            {item.solutionSteps != null && (
              <InfoRow label="풀이 단계">{item.solutionSteps}단계</InfoRow>
            )}
            <InfoRow label="활용 목적">
              {usagePurposeLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {usagePurposeLabels.map((label: string) => (
                    <MetaBadge key={label}>{label}</MetaBadge>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </InfoRow>
            <InfoRow label="생성일">{formatDate(item.createdAt)}</InfoRow>
            <InfoRow label="수정일">{formatDate(item.updatedAt)}</InfoRow>
          </dl>

          {/* 난이도 프로필 상세 (존재 시) */}
          {difficultyProfile && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <h3 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                난이도 프로필 상세
              </h3>
              <dl className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
                <InfoRow label="출제자">
                  {difficultyProfile.authorDifficulty}
                </InfoRow>
                {difficultyProfile.behavioralDifficulty != null && (
                  <InfoRow label="행동">
                    {formatNumberish(difficultyProfile.behavioralDifficulty)}
                  </InfoRow>
                )}
                {difficultyProfile.irtDifficulty != null && (
                  <InfoRow label="IRT 난이도">
                    {formatNumberish(difficultyProfile.irtDifficulty)}
                  </InfoRow>
                )}
                {difficultyProfile.irtDiscrimination != null && (
                  <InfoRow label="IRT 변별도">
                    {formatNumberish(difficultyProfile.irtDiscrimination)}
                  </InfoRow>
                )}
                {difficultyProfile.irtGuessing != null && (
                  <InfoRow label="IRT 추측도">
                    {formatNumberish(difficultyProfile.irtGuessing)}
                  </InfoRow>
                )}
              </dl>
            </div>
          )}
        </Section>

        {/* ─── 3. 관련 메타데이터 ─── */}
        <Section title="관련 메타데이터">
          {/* 스킬 */}
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              스킬 ({skills.length})
            </h3>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill: { id: string; code: string; title: string; topicPath: string }) => (
                  <MetaBadge key={skill.id} className="bg-indigo-50 text-indigo-700">
                    {skill.code} - {skill.title}
                  </MetaBadge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">연결된 스킬이 없습니다.</p>
            )}
          </div>

          {/* 성취기준 */}
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              성취기준 ({standards.length})
            </h3>
            {standards.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {standards.map((std: { id: string; code: string; title: string }) => (
                  <MetaBadge key={std.id} className="bg-emerald-50 text-emerald-700">
                    {std.code} - {std.title}
                  </MetaBadge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">연결된 성취기준이 없습니다.</p>
            )}
          </div>

          {/* 오개념 */}
          <div>
            <h3 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              오개념 ({misconceptions.length})
            </h3>
            {misconceptions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {misconceptions.map((mc: { id: string; code: string; title: string }) => (
                  <MetaBadge key={mc.id} className="bg-amber-50 text-amber-700">
                    {mc.code} - {mc.title}
                  </MetaBadge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">연결된 오개념이 없습니다.</p>
            )}
          </div>
        </Section>

        {/* ─── 4. 풀이 정보 ─── */}
        {solutions.length > 0 && (
          <Section title={`풀이 (${solutions.length})`}>
            <div className="flex flex-col gap-4">
              {solutions.map((sol) => {
                  const steps = parseSolutionSteps(sol.steps);
                  const methodLabel =
                    SOLUTION_METHOD[sol.method as SolutionMethodKey]?.label ??
                    sol.method;
                  return (
                    <div
                      key={sol.id}
                      className="rounded-md border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <MetaBadge className="bg-violet-50 text-violet-700">
                          {methodLabel}
                        </MetaBadge>
                        <span className="text-xs text-slate-500">
                          최종 정답:{" "}
                          <KatexRenderer
                            latex={sol.finalAnswer}
                            displayMode={false}
                            className="inline text-xs"
                          />
                        </span>
                      </div>
                      {sol.explanation && (
                        <p className="mb-3 text-xs text-slate-600">
                          {sol.explanation}
                        </p>
                      )}
                      {steps.length > 0 && (
                        <ol className="flex flex-col gap-2">
                          {steps.map((step) => (
                            <li
                              key={step.stepNum}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
                                {step.stepNum}
                              </span>
                              <div className="flex flex-col gap-1">
                                <KatexRenderer
                                  latex={step.latex}
                                  displayMode={false}
                                  className="text-sm text-slate-800"
                                />
                                <span className="text-slate-500">
                                  {step.explanation}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
            </div>
          </Section>
        )}

        {/* ─── 5. 버전 이력 ─── */}
        <Section title={`버전 이력 (${versions.length})`}>
          {versions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="pb-2 pr-4 font-medium">버전</th>
                    <th className="pb-2 pr-4 font-medium">변경 사유</th>
                    <th className="pb-2 pr-4 font-medium">일자</th>
                    <th className="pb-2 font-medium">수식 보기</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map(
                    (ver: {
                      id: string;
                      version: number;
                      bodyLatex: string;
                      changeSummary: string | null;
                      createdAt: Date;
                    }) => {
                      const isSelected = selectedVersionNum === ver.version;
                      return (
                        <tr
                          key={ver.id}
                          className={cn(
                            "border-b border-slate-100",
                            isSelected && "bg-amber-50",
                          )}
                        >
                          <td className="py-2 pr-4 font-mono text-xs">
                            v{ver.version}
                            {ver.version === item.currentVersion && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                (현재)
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-slate-600">
                            {ver.changeSummary ?? "-"}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {formatShortDate(ver.createdAt)}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleVersionSelect(ver.version, ver.bodyLatex)
                              }
                              className={cn(
                                "text-xs underline",
                                isSelected
                                  ? "text-amber-600"
                                  : "text-slate-500 hover:text-slate-700",
                              )}
                            >
                              {isSelected ? "선택 해제" : "보기"}
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">버전 이력이 없습니다.</p>
          )}
        </Section>

        {/* ─── 6. 유사 문항 (Phase 6) ─── */}
        <SimilarItemsPanel itemId={id} />

        {/* ─── 7. 3중 표현 정보 (접기/펼치기) ─── */}
        <CollapsibleSection title="3중 표현 정보">
          <div className="flex flex-col gap-4">
            {/* MathML */}
            <CodeBlock
              label="MathML"
              content={item.bodyMathml ?? "변환 데이터 없음"}
            />

            {/* SymPy AST */}
            <CodeBlock
              label="SymPy AST"
              content={item.bodySympy ?? "변환 실패"}
            />

            {/* HTML (존재 시) */}
            {item.bodyHtml && (
              <CodeBlock label="HTML" content={item.bodyHtml} />
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
