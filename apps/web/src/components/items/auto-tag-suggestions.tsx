"use client";

// 시맨틱 메타데이터 자동 태깅 제안 UI
// 문항 본문 기반으로 스킬/성취기준/오개념/블룸 수준을 추천한다.
import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { BLOOM_LEVEL } from "@math-item-os/shared/constants/index";

// -------------------------------------------------
// 타입
// -------------------------------------------------

interface AutoTagSuggestionsProps {
  readonly bodyLatex: string;
  readonly schoolLevel: "elementary" | "middle" | "high";
  readonly grade: number;
  readonly itemType?: string;
  readonly formulaType?: string;
  readonly solutionSteps?: number;
  readonly selectedSkillIds: string[];
  readonly selectedStandardIds: string[];
  readonly selectedMisconceptionIds: string[];
  readonly onSkillSelect: (id: string) => void;
  readonly onStandardSelect: (id: string) => void;
  readonly onMisconceptionSelect: (id: string) => void;
}

// -------------------------------------------------
// 디바운스 훅
// -------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// -------------------------------------------------
// 컴포넌트
// -------------------------------------------------

export function AutoTagSuggestions({
  bodyLatex,
  schoolLevel,
  grade,
  itemType,
  formulaType,
  solutionSteps,
  selectedSkillIds,
  selectedStandardIds,
  selectedMisconceptionIds,
  onSkillSelect,
  onStandardSelect,
  onMisconceptionSelect,
}: AutoTagSuggestionsProps) {
  const debouncedBody = useDebouncedValue(bodyLatex, 500);

  const input = useMemo(
    () => ({
      bodyLatex: debouncedBody,
      schoolLevel: schoolLevel as "elementary" | "middle" | "high",
      grade,
      ...(itemType
        ? {
            itemType: itemType as
              | "multiple_choice"
              | "short_answer"
              | "essay"
              | "fill_in_blank"
              | "true_false",
          }
        : {}),
      ...(formulaType
        ? {
            formulaType: formulaType as
              | "inline"
              | "display"
              | "mixed"
              | "none",
          }
        : {}),
      ...(solutionSteps != null ? { solutionSteps } : {}),
    }),
    [debouncedBody, schoolLevel, grade, itemType, formulaType, solutionSteps],
  );

  const { data, isLoading, error } = trpc.item.suggestMetadata.useQuery(
    input,
    { enabled: debouncedBody.length > 0 },
  );

  // 본문이 비어 있으면 아무것도 렌더링하지 않음
  if (!debouncedBody) return null;

  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-slate-700">
        메타데이터 자동 추천
      </legend>

      {isLoading && <SkeletonBlock />}

      {error && (
        <p className="mt-2 text-sm text-amber-600">
          추천 데이터를 불러오지 못했습니다.
        </p>
      )}

      {data && (
        <div className="mt-2 flex flex-col gap-4">
          {/* 블룸 수준 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              Bloom 수준
            </span>
            <BloomBadge level={data.bloomLevel} />
          </div>

          {/* 스킬 제안 */}
          {data.skills.length > 0 && (
            <SuggestionSection title="스킬 제안">
              {data.skills.map((skill) => (
                <Chip
                  key={skill.id}
                  label={skill.title}
                  sublabel={`${Math.round(skill.similarity * 100)}%`}
                  selected={selectedSkillIds.includes(skill.id)}
                  onToggle={() => onSkillSelect(skill.id)}
                />
              ))}
            </SuggestionSection>
          )}

          {/* 성취기준 */}
          {data.standards.length > 0 && (
            <SuggestionSection title="성취기준">
              {data.standards.map((std) => (
                <Chip
                  key={std.id}
                  label={`${std.code} ${std.title}`}
                  selected={selectedStandardIds.includes(std.id)}
                  onToggle={() => onStandardSelect(std.id)}
                />
              ))}
            </SuggestionSection>
          )}

          {/* 오개념 */}
          {data.misconceptions.length > 0 && (
            <SuggestionSection title="오개념">
              {data.misconceptions.map((mc) => (
                <Chip
                  key={mc.id}
                  label={mc.title}
                  sublabel={mc.typicalError ?? undefined}
                  selected={selectedMisconceptionIds.includes(mc.id)}
                  onToggle={() => onMisconceptionSelect(mc.id)}
                />
              ))}
            </SuggestionSection>
          )}

          {/* 모든 추천이 비어 있는 경우 */}
          {data.skills.length === 0 &&
            data.standards.length === 0 &&
            data.misconceptions.length === 0 && (
              <p className="text-sm text-slate-400">
                일치하는 메타데이터가 없습니다.
              </p>
            )}
        </div>
      )}
    </fieldset>
  );
}

// -------------------------------------------------
// 하위 컴포넌트
// -------------------------------------------------

function BloomBadge({ level }: Readonly<{ level: number }>) {
  const info = BLOOM_LEVEL[level as keyof typeof BLOOM_LEVEL];
  const label = info ? `${info.label}(${level})` : `Level ${level}`;

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

function SuggestionSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-600">{title}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  label,
  sublabel,
  selected,
  onToggle,
}: Readonly<{
  label: string;
  sublabel?: string;
  selected: boolean;
  onToggle: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm transition-colors ${
        selected
          ? "border-slate-400 bg-slate-100 text-slate-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="text-xs">{selected ? "\u2713" : "+"}</span>
      <span>{label}</span>
      {sublabel && (
        <span className="text-xs text-slate-400">{sublabel}</span>
      )}
    </button>
  );
}

function SkeletonBlock() {
  return (
    <div className="mt-2 flex flex-col gap-3 animate-pulse">
      <div className="h-4 w-24 rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-7 w-20 rounded bg-slate-100" />
        <div className="h-7 w-28 rounded bg-slate-100" />
        <div className="h-7 w-16 rounded bg-slate-100" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-32 rounded bg-slate-100" />
        <div className="h-7 w-24 rounded bg-slate-100" />
      </div>
    </div>
  );
}
