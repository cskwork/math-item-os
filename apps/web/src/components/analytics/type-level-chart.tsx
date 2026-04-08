"use client";

// typeLevel별 정답률 수평 막대 차트 (순수 CSS)
// 색상: >= 80% 녹색, >= 60% 노란색, < 60% 빨간색

import { cn } from "@/lib/utils";
import type { TypeLevelStat } from "@math-item-os/shared/types/index";

// -------------------------------------------------
// 타입
// -------------------------------------------------

interface TypeLevelChartProps {
  readonly stats: ReadonlyArray<TypeLevelStat>;
}

// -------------------------------------------------
// 색상 분류
// -------------------------------------------------

/** 정답률 기준 색상 클래스 반환 */
function getBarColorClass(rate: number): string {
  if (rate >= 0.8) return "bg-green-500";
  if (rate >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}

/** 정답률 기준 텍스트 색상 클래스 반환 */
function getTextColorClass(rate: number): string {
  if (rate >= 0.8) return "text-green-700";
  if (rate >= 0.6) return "text-yellow-700";
  return "text-red-700";
}

// -------------------------------------------------
// 개별 바
// -------------------------------------------------

interface BarRowProps {
  readonly stat: TypeLevelStat;
}

function BarRow({ stat }: BarRowProps) {
  const percentage = Math.round(stat.correctRate * 100);
  const barColor = getBarColorClass(stat.correctRate);
  const textColor = getTextColorClass(stat.correctRate);
  const isWeak = stat.correctRate < 0.6;

  return (
    <div className="flex items-center gap-3">
      {/* 라벨 */}
      <span className="w-20 shrink-0 text-right text-sm font-medium text-slate-700">
        {stat.label}
      </span>

      {/* 바 컨테이너 */}
      <div className="relative flex-1">
        <div className="h-7 w-full overflow-hidden rounded-md bg-slate-100">
          <div
            className={cn("h-full rounded-md transition-all duration-500", barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* 퍼센트 + 경고 */}
      <span
        className={cn(
          "w-16 shrink-0 text-right text-sm font-semibold",
          textColor,
        )}
      >
        {percentage}%{isWeak ? " !" : ""}
      </span>
    </div>
  );
}

// -------------------------------------------------
// 차트 컴포넌트
// -------------------------------------------------

export function TypeLevelChart({ stats }: TypeLevelChartProps) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        typeLevel별 분석 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {stats.map((stat) => (
        <BarRow key={stat.typeLevel} stat={stat} />
      ))}
    </div>
  );
}
