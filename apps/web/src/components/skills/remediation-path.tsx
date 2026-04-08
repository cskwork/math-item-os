"use client";

import { memo, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DIFFICULTY_LEVEL,
  SCHOOL_LEVEL,
} from "@math-item-os/shared/constants/index";

// ─── 타입 정의 ───

interface RemediationPathProps {
  readonly misconceptionId: string | null;
  readonly difficulty?: number;
  readonly limit?: number;
  readonly onItemClick?: (itemId: string) => void;
}

type PhaseKey = "prerequisite_review" | "basic_practice" | "confirmation";

interface StepItem {
  readonly id: string;
  readonly bodyLatex: string;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly difficultyAuthor: number | null;
  readonly status: string;
  readonly skills: ReadonlyArray<{ skill: { id: string; title: string } }>;
  readonly standards: ReadonlyArray<{ standard: { id: string; title: string } }>;
  readonly misconceptions: ReadonlyArray<{ misconception: { id: string; title: string } }>;
}

interface StepData {
  readonly phase: PhaseKey;
  readonly items: ReadonlyArray<StepItem>;
  readonly explanation: string;
}

// ─── 단계 메타데이터 ───

interface PhaseMeta {
  readonly label: string;
  readonly number: number;
  readonly circleColor: string;
  readonly lineColor: string;
  readonly cardBorder: string;
  readonly cardBg: string;
  readonly badgeBg: string;
  readonly badgeText: string;
}

const PHASE_META: Record<PhaseKey, PhaseMeta> = {
  prerequisite_review: {
    label: "1단계: 선수 개념 복습",
    number: 1,
    circleColor: "bg-blue-500 text-white",
    lineColor: "bg-blue-300",
    cardBorder: "border-blue-200",
    cardBg: "bg-blue-50/40",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
  },
  basic_practice: {
    label: "2단계: 기본 연습",
    number: 2,
    circleColor: "bg-amber-500 text-white",
    lineColor: "bg-amber-300",
    cardBorder: "border-amber-200",
    cardBg: "bg-amber-50/40",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  confirmation: {
    label: "3단계: 이해 확인",
    number: 3,
    circleColor: "bg-green-500 text-white",
    lineColor: "bg-green-300",
    cardBorder: "border-green-200",
    cardBg: "bg-green-50/40",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
} as const;

const PHASE_ORDER: ReadonlyArray<PhaseKey> = [
  "prerequisite_review",
  "basic_practice",
  "confirmation",
];

// ─── 난이도 배지 색상 ───

const DIFFICULTY_BADGE_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-lime-100 text-lime-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

// ─── 유틸리티 ───

/** LaTeX 본문을 100자로 절단 */
function truncateLatex(latex: string): string {
  if (latex.length <= 100) return latex;
  return `${latex.slice(0, 100)}...`;
}

/** 숫자 키 상수에서 라벨 반환 */
function getNumericLabel(
  map: Record<number, { label: string }>,
  key: number | null,
): string | null {
  if (key === null) return null;
  return map[key]?.label ?? String(key);
}

/** 문자열 키 상수에서 라벨 반환 */
function getLabel(map: Record<string, { label: string }>, key: string): string {
  return map[key]?.label ?? key;
}

// ─── 스켈레톤 로딩 ───

function StepSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-2 h-full w-0.5 animate-pulse bg-slate-200" />
      </div>
      <div className="flex-1 space-y-3 pb-8">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <StepSkeleton />
      <StepSkeleton />
      <StepSkeleton />
    </div>
  );
}

// ─── 개별 문항 카드 ───

const StepItemCard = memo(function StepItemCard({
  item,
  phaseMeta,
  onItemClick,
}: {
  readonly item: StepItem;
  readonly phaseMeta: PhaseMeta;
  readonly onItemClick?: (itemId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onItemClick?.(item.id);
  }, [onItemClick, item.id]);

  const difficultyLabel = getNumericLabel(
    DIFFICULTY_LEVEL as unknown as Record<number, { label: string }>,
    item.difficultyAuthor,
  );
  const difficultyColor =
    item.difficultyAuthor !== null
      ? DIFFICULTY_BADGE_COLORS[item.difficultyAuthor] ?? "bg-slate-100 text-slate-700"
      : null;
  const schoolLabel = getLabel(SCHOOL_LEVEL, item.schoolLevel);

  // 최대 2개 스킬 태그만 표시
  const visibleSkills = item.skills.slice(0, 2);
  const remainingSkillCount = item.skills.length - visibleSkills.length;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!onItemClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        phaseMeta.cardBorder,
        onItemClick
          ? "cursor-pointer hover:shadow-sm hover:brightness-95"
          : "cursor-default",
      )}
    >
      {/* LaTeX 본문 */}
      <p className="text-sm font-mono leading-relaxed text-slate-800">
        {truncateLatex(item.bodyLatex)}
      </p>

      {/* 메타 배지 */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* 난이도 배지 */}
        {difficultyLabel && difficultyColor && (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              difficultyColor,
            )}
          >
            {difficultyLabel}
          </span>
        )}

        {/* 학교급/학년 */}
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {schoolLabel} {item.grade}학년
        </span>

        {/* 스킬 태그 */}
        {visibleSkills.map((s) => (
          <span
            key={s.skill.id}
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              phaseMeta.badgeBg,
              phaseMeta.badgeText,
            )}
          >
            {s.skill.title}
          </span>
        ))}
        {remainingSkillCount > 0 && (
          <span className="text-xs text-slate-400">
            +{remainingSkillCount}
          </span>
        )}
      </div>
    </button>
  );
});

// ─── 단계 컴포넌트 ───

const PhaseStep = memo(function PhaseStep({
  step,
  isLast,
  onItemClick,
}: {
  readonly step: StepData;
  readonly isLast: boolean;
  readonly onItemClick?: (itemId: string) => void;
}) {
  const meta = PHASE_META[step.phase];

  return (
    <div className="flex gap-4">
      {/* 타임라인: 번호 원형 + 연결선 */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            meta.circleColor,
          )}
        >
          {meta.number}
        </div>
        {!isLast && (
          <div className={cn("mt-1 w-0.5 flex-1", meta.lineColor)} />
        )}
      </div>

      {/* 단계 내용 */}
      <div className={cn("flex-1 pb-8", isLast && "pb-0")}>
        {/* 단계 제목 */}
        <h3 className="text-sm font-semibold text-slate-800">{meta.label}</h3>

        {/* 설명 텍스트 */}
        <p className="mt-1 text-xs text-slate-500">{step.explanation}</p>

        {/* 문항 카드 목록 */}
        <div className={cn("mt-3 space-y-2 rounded-lg border p-3", meta.cardBorder, meta.cardBg)}>
          {step.items.length > 0 ? (
            step.items.map((item) => (
              <StepItemCard
                key={item.id}
                item={item}
                phaseMeta={meta}
                onItemClick={onItemClick}
              />
            ))
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">
              해당 단계의 문항이 없습니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── 빈 상태/에러 표시 ───

function NoMisconceptionSelected() {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-slate-400">
        오개념을 선택하면 교정 학습 경로가 표시됩니다
      </p>
    </div>
  );
}

function EmptyPath() {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-center text-sm text-slate-400">
        교정 경로를 생성할 수 없습니다.
        <br />
        관련 스킬이 설정되어 있는지 확인해주세요.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-center text-sm text-red-600">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        다시 시도
      </Button>
    </div>
  );
}

// ─── 단계 목록 래퍼 ───

const StepList = memo(function StepList({
  steps,
  onItemClick,
}: {
  readonly steps: ReadonlyArray<StepData>;
  readonly onItemClick?: (itemId: string) => void;
}) {
  // PHASE_ORDER 순서에 맞춰 정렬된 steps를 참조
  const orderedSteps = PHASE_ORDER.map(
    (phase) => steps.find((s) => s.phase === phase),
  ).filter((s): s is StepData => s != null);

  return (
    <div className="space-y-0">
      {orderedSteps.map((step, index) => (
        <PhaseStep
          key={step.phase}
          step={step}
          isLast={index === orderedSteps.length - 1}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
});

// ─── 메인 컴포넌트 ───

function RemediationPath({
  misconceptionId,
  difficulty,
  limit,
  onItemClick,
}: RemediationPathProps) {
  const { data, isLoading, isError, error, refetch } =
    trpc.skill.getRemediationPath.useQuery(
      {
        misconceptionId: misconceptionId!,
        ...(difficulty != null && { difficulty }),
        ...(limit != null && { limit }),
      },
      { enabled: misconceptionId != null },
    );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // 오개념 미선택 상태
  if (misconceptionId == null) {
    return <NoMisconceptionSelected />;
  }

  // 로딩 상태
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // 에러 상태
  if (isError) {
    return (
      <ErrorState
        message={error?.message ?? "교정 경로 조회 중 오류가 발생했습니다"}
        onRetry={handleRetry}
      />
    );
  }

  // 빈 경로: steps가 없거나 모든 단계의 items가 비어있는 경우
  const hasAnyItems =
    data?.steps.some((s: StepData) => s.items.length > 0) ?? false;
  if (!data || data.steps.length === 0 || !hasAnyItems) {
    return <EmptyPath />;
  }

  return <StepList steps={data.steps as ReadonlyArray<StepData>} onItemClick={onItemClick} />;
}

export { RemediationPath };
