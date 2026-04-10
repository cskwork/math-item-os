"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";
import {
  DIFFICULTY_LEVEL,
  type DifficultyLevelKey,
} from "@math-item-os/shared/constants/index";

// --- 타입 ---

interface SimilarSignals {
  readonly skillMatch: number;
  readonly formulaStructure: number;
  readonly prerequisiteDistance: number;
  readonly textSemantic: number;
  readonly difficultyProximity: number;
  readonly misconceptionProfile: number;
}

interface SimilarItemEntry {
  readonly item: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly difficultyAuthor: number | null;
  };
  readonly score: number;
  readonly signals: SimilarSignals;
  readonly explanation: string;
}

interface SimilarItemsPanelProps {
  readonly itemId: string;
}

// --- 상수 ---

const SIMILAR_LIMIT = 10;
const LATEX_MAX = 80;

const SIGNAL_LABELS: Record<keyof SimilarSignals, string> = {
  skillMatch: "스킬 일치",
  formulaStructure: "수식 구조",
  prerequisiteDistance: "선수학습",
  textSemantic: "텍스트 유사",
  difficultyProximity: "난이도",
  misconceptionProfile: "오개념",
} as const;

const SIGNAL_KEYS = Object.keys(SIGNAL_LABELS) as ReadonlyArray<keyof SimilarSignals>;

// --- 유틸 ---

function truncateLatex(latex: string): string {
  return latex.length <= LATEX_MAX
    ? latex
    : latex.slice(0, LATEX_MAX) + "\\cdots";
}

function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

function scoreColorClass(score: number): string {
  if (score > 0.7) return "bg-green-500";
  if (score >= 0.4) return "bg-yellow-500";
  return "bg-slate-400";
}

function scoreTextClass(score: number): string {
  if (score > 0.7) return "text-green-700";
  if (score >= 0.4) return "text-yellow-700";
  return "text-slate-500";
}

// --- 신호 진행 바 ---

function SignalBar({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  const pct = scoreToPercent(value);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={cn("h-1.5 rounded-full", scoreColorClass(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {pct}%
      </span>
    </div>
  );
}

// --- 유사 문항 카드 ---

function SimilarItemCard({
  item,
  score,
  signals,
  explanation,
}: {
  readonly item: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly difficultyAuthor: number | null;
  };
  readonly score: number;
  readonly signals: SimilarSignals;
  readonly explanation: string;
}) {
  const [showSignals, setShowSignals] = useState(false);
  const toggleSignals = useCallback(() => setShowSignals((prev) => !prev), []);

  const pct = scoreToPercent(score);
  const diffLabel =
    item.difficultyAuthor != null
      ? (DIFFICULTY_LEVEL[item.difficultyAuthor as DifficultyLevelKey]?.label ??
        null)
      : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* 점수 + 난이도 */}
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "text-lg font-semibold tabular-nums",
            scoreTextClass(score),
          )}
        >
          {pct}%
        </span>
        <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className={cn("h-2 rounded-full transition-all", scoreColorClass(score))}
            style={{ width: `${pct}%` }}
          />
        </div>
        {diffLabel != null && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {diffLabel}
          </span>
        )}
      </div>

      {/* 수식 미리보기 */}
      <div className="mb-2 line-clamp-2 min-h-[2rem] overflow-hidden">
        <KatexRenderer
          latex={truncateLatex(item.bodyLatex)}
          displayMode={false}
          className="text-sm leading-relaxed text-slate-800"
        />
      </div>

      {/* 설명 */}
      <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {explanation}
      </p>

      {/* 하단: 신호 토글 + 상세 링크 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleSignals}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          {showSignals ? "신호 접기" : "신호 상세"}
        </button>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={`/items/${item.id}` as any}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          문항 보기 &rarr;
        </Link>
      </div>

      {/* 신호 상세 (접기/펼치기) */}
      {showSignals && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-700">
          {SIGNAL_KEYS.map((key) => (
            <SignalBar
              key={key}
              label={SIGNAL_LABELS[key]!}
              value={signals[key] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- 스켈레톤 ---

const SKELETON_COUNT = 3;

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <div className="h-6 w-10 rounded bg-slate-200" />
            <div className="h-2 flex-1 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-200" />
          </div>
          <div className="h-3 w-3/4 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

// --- 메인 컴포넌트 ---

export function SimilarItemsPanel({ itemId }: SimilarItemsPanelProps) {
  const { data, isLoading, error } = trpc.search.similar.useQuery({
    itemId,
    limit: SIMILAR_LIMIT,
  });

  const items = data?.items ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">유사 문항</h2>
        {!isLoading && !error && (
          <span className="text-xs text-slate-400">{items.length}건</span>
        )}
      </div>

      {/* 로딩 */}
      {isLoading && <PanelSkeleton />}

      {/* 에러 */}
      {!isLoading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">
            유사 문항을 불러오는 중 오류가 발생했습니다.
          </p>
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <svg
            className="mb-2 h-10 w-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm">유사한 문항이 없습니다</p>
        </div>
      )}

      {/* 결과 목록 */}
      {!isLoading && !error && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((entry: SimilarItemEntry) => (
            <SimilarItemCard
              key={entry.item.id}
              item={entry.item}
              score={entry.score}
              signals={entry.signals}
              explanation={entry.explanation}
            />
          ))}
        </div>
      )}
    </section>
  );
}
