"use client";

// 점수 요약 카드 4종: 평균, 중앙값, 최저, 최고

// -------------------------------------------------
// 타입
// -------------------------------------------------

interface ScoreSummaryCardsProps {
  readonly avgScore: number;
  readonly medianScore: number;
  readonly minScore: number;
  readonly maxScore: number;
}

interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly colorClass: string;
}

// -------------------------------------------------
// 개별 카드
// -------------------------------------------------

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-4 py-5">
      <span className={`text-2xl font-bold ${colorClass}`}>
        {value.toFixed(1)}
      </span>
      <span className="mt-1 text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

// -------------------------------------------------
// 카드 그리드
// -------------------------------------------------

export function ScoreSummaryCards({
  avgScore,
  medianScore,
  minScore,
  maxScore,
}: ScoreSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="평균" value={avgScore} colorClass="text-blue-600" />
      <StatCard
        label="중앙값"
        value={medianScore}
        colorClass="text-indigo-600"
      />
      <StatCard label="최저" value={minScore} colorClass="text-red-600" />
      <StatCard label="최고" value={maxScore} colorClass="text-green-600" />
    </div>
  );
}
