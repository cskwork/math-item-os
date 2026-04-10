"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

interface AutoReviewResult {
  overallScore: number;
  checks: {
    latexValid: { passed: boolean; message: string };
    metadataComplete: { passed: boolean; score: number; missing: string[] };
    duplicateDetected: {
      passed: boolean;
      similarItemIds: string[];
      bestDistance: number | null;
    };
    casSolvable: { passed: boolean; message: string };
  };
  suggestedAction: "approve" | "review" | "flag";
}

interface DifficultyEstimate {
  estimated: number;
  confidence: number;
  factors: string[];
}

interface ReviewSuggestionRow {
  id: string;
  checkType: string;
  result: unknown;
  overallScore: number | null;
  suggestedAction: string | null;
  createdAt: Date;
}

// -------------------------------------------------
// 상수
// -------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  approve: "승인 권장",
  review: "검수 필요",
  flag: "주의 필요",
};

const ACTION_COLORS: Record<string, string> = {
  approve:
    "bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300",
  review:
    "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300",
  flag: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300",
};

const CHECK_LABELS: Record<string, string> = {
  latexValid: "LaTeX 유효성",
  metadataComplete: "메타데이터 완전성",
  duplicateDetected: "중복 감지",
  casSolvable: "CAS 풀이 검증",
};

// -------------------------------------------------
// 유틸
// -------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 0.8) return "bg-green-500";
  if (score >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 0.8)
    return "text-green-700 dark:text-green-400";
  if (score >= 0.5)
    return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400";
}

// -------------------------------------------------
// 자동 리뷰 카드
// -------------------------------------------------

function AutoReviewCard({ data }: { readonly data: AutoReviewResult }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(data.overallScore * 100);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* 헤더: 점수 바 + 액션 배지 */}
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("text-lg font-semibold tabular-nums", scoreTextColor(data.overallScore))}>
          {pct}%
        </span>
        <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className={cn("h-2 rounded-full transition-all", scoreColor(data.overallScore))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            ACTION_COLORS[data.suggestedAction] ?? ACTION_COLORS.flag,
          )}
        >
          {ACTION_LABELS[data.suggestedAction] ?? data.suggestedAction}
        </span>
      </div>

      {/* 토글 */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
      >
        {expanded ? "검사 상세 접기" : "검사 상세 보기"}
      </button>

      {/* 상세 검사 목록 */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          {Object.entries(data.checks).map(([key, check]) => {
            const passed = check.passed;
            return (
              <div key={key} className="flex items-start gap-2">
                <span className={cn("mt-0.5 text-sm", passed ? "text-green-500" : "text-red-500")}>
                  {passed ? "O" : "X"}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {CHECK_LABELS[key] ?? key}
                  </p>
                  {"message" in check && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(check as { message: string }).message}
                    </p>
                  )}
                  {"missing" in check && (check as { missing: string[] }).missing.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      누락: {(check as { missing: string[] }).missing.join(", ")}
                    </p>
                  )}
                  {"similarItemIds" in check &&
                    (check as { similarItemIds: string[] }).similarItemIds.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        유사 문항: {(check as { similarItemIds: string[] }).similarItemIds.length}건
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------
// 난이도 추정 카드
// -------------------------------------------------

function DifficultyEstimateCard({ data }: { readonly data: DifficultyEstimate }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          AI 추정 난이도
        </span>
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {data.estimated}
        </span>
        <span className="text-xs text-slate-400">
          / 5 (신뢰도 {Math.round(data.confidence * 100)}%)
        </span>
      </div>
      {/* 난이도 별 시각화 */}
      <div className="mb-2 flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i < data.estimated
                ? "bg-indigo-500"
                : "bg-slate-100 dark:bg-slate-700",
            )}
          />
        ))}
      </div>
      {/* 요인 태그 */}
      <div className="flex flex-wrap gap-1">
        {data.factors.map((factor) => (
          <span
            key={factor}
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          >
            {factor}
          </span>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------
// 스켈레톤
// -------------------------------------------------

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-6 w-10 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------
// 메인 컴포넌트
// -------------------------------------------------

interface ReviewSuggestionsProps {
  readonly itemId: string;
}

export function ReviewSuggestions({ itemId }: ReviewSuggestionsProps) {
  const { data, isLoading, error } = trpc.item.getReviewSuggestions.useQuery({
    itemId,
  });

  const suggestions = (data ?? []) as ReviewSuggestionRow[];

  const autoReview = suggestions.find((s) => s.checkType === "auto_review");
  const difficultyEstimate = suggestions.find(
    (s) => s.checkType === "difficulty_estimate",
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
        AI 자동 검토
      </h2>

      {isLoading && <ReviewSkeleton />}

      {!isLoading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">
            검토 결과를 불러오는 중 오류가 발생했습니다.
          </p>
        </div>
      )}

      {!isLoading && !error && suggestions.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          검토 대기 중
        </p>
      )}

      {!isLoading && !error && suggestions.length > 0 && (
        <div className="flex flex-col gap-3">
          {autoReview && (
            <AutoReviewCard data={autoReview.result as AutoReviewResult} />
          )}
          {difficultyEstimate && (
            <DifficultyEstimateCard
              data={difficultyEstimate.result as DifficultyEstimate}
            />
          )}
        </div>
      )}
    </section>
  );
}
