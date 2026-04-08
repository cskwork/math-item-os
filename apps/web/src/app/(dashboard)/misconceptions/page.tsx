"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { MisconceptionSelector } from "@/components/skills/misconception-selector";
import { RemediationPath } from "@/components/skills/remediation-path";

// --- 난이도 옵션 ---

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "1 (매우 쉬움)" },
  { value: 2, label: "2 (쉬���)" },
  { value: 3, label: "3 (보통)" },
  { value: 4, label: "4 (어려움)" },
  { value: 5, label: "5 (매우 어려움)" },
] as const;

// --- 메인 페이지 ---

export default function MisconceptionsPage() {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(3);

  const handleSelect = useCallback((misconceptionId: string) => {
    setSelectedId(misconceptionId);
  }, []);

  const handleDifficultyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDifficulty(Number(e.target.value));
    },
    [],
  );

  const handleItemClick = useCallback(
    (itemId: string) => {
      router.push(`/items/${itemId}`);
    },
    [router],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            오개념 탐색
          </h1>
          <p className="text-sm text-slate-500">
            오개념을 선택하면 단계별 교정 학습 경로가 생성됩니다
          </p>
        </div>

        {/* 난이도 기준 선택 */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="difficulty-selector"
            className="text-xs font-medium text-slate-500 whitespace-nowrap"
          >
            난이도 기준
          </label>
          <select
            id="difficulty-selector"
            value={difficulty}
            onChange={handleDifficultyChange}
            className="h-9 w-40 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2-column 레이아웃: 왼쪽 오개념 목록, 오른쪽 교정 경로 */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 왼쪽: 오개념 선택기 */}
        <div className="w-[400px] shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <MisconceptionSelector
            onSelect={handleSelect}
            selectedId={selectedId}
          />
        </div>

        {/* 오른쪽: 교정 학습 경로 */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <RemediationPath
            misconceptionId={selectedId}
            difficulty={difficulty}
            onItemClick={handleItemClick}
          />
        </div>
      </div>
    </div>
  );
}
