"use client";

import { useCallback, useMemo } from "react";
import {
  SUBJECT_OPTIONS,
  CODE_LANGUAGE_OPTIONS,
  SCHOOL_LEVEL_OPTIONS,
  ITEM_TYPE_OPTIONS,
  DIFFICULTY_LEVEL_OPTIONS,
  USAGE_PURPOSE_OPTIONS,
  GRADE_BY_LEVEL,
  TYPE_LEVEL_OPTIONS,
} from "@math-item-os/shared/constants/index";
import type { SearchFacets } from "@math-item-os/shared/types/index";

// --- 필터 값 타입 ---
export interface SearchFilters {
  readonly subject: string;
  readonly schoolLevel: string;
  readonly grade: string;
  readonly itemType: string;
  readonly codeLanguage: string;
  readonly difficultyMin: string;
  readonly difficultyMax: string;
  readonly usagePurpose: string;
  readonly typeLevel: string;
}

export const INITIAL_SEARCH_FILTERS: SearchFilters = {
  subject: "",
  schoolLevel: "",
  grade: "",
  itemType: "",
  codeLanguage: "",
  difficultyMin: "",
  difficultyMax: "",
  usagePurpose: "",
  typeLevel: "",
};

function FilterSelect({
  label, value, onChange, options, placeholder = "전체", disabled = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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

// 패싯 카운트를 옵션 라벨에 부착 (예: "중등 (42)")
function withFacetCount(
  options: readonly { value: string | number; label: string }[],
  facetMap?: Record<string, number> | Record<number, number>,
): readonly { value: string | number; label: string }[] {
  if (!facetMap) return options;
  return options.map((opt) => {
    const count = (facetMap as Record<string, number>)[String(opt.value)];
    return count != null ? { ...opt, label: `${opt.label} (${count})` } : opt;
  });
}

interface FilterPanelProps {
  readonly filters: SearchFilters;
  readonly onFilterChange: (key: keyof SearchFilters, value: string) => void;
  readonly onReset: () => void;
  readonly facets?: SearchFacets;
}

export function FilterPanel({ filters, onFilterChange, onReset, facets }: FilterPanelProps) {
  // 학교급에 따른 학년 옵션 동적 생성
  const gradeOptions = useMemo(() => {
    if (!filters.schoolLevel) return [];
    const key = filters.schoolLevel as keyof typeof GRADE_BY_LEVEL;
    const grades = GRADE_BY_LEVEL[key];
    if (!grades) return [];
    return grades.map((g: number) => ({ value: g, label: `${g}학년` }));
  }, [filters.schoolLevel]);

  // 학교급 변경 시 학년 초기화
  const handleSchoolLevelChange = useCallback(
    (value: string) => {
      onFilterChange("schoolLevel", value);
      onFilterChange("grade", "");
    },
    [onFilterChange],
  );

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ""),
    [filters],
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
        <FilterSelect
          label="과목"
          value={filters.subject}
          onChange={(v) => {
            onFilterChange("subject", v);
            if (v !== "IT_CERT") onFilterChange("codeLanguage", "");
          }}
          options={withFacetCount(SUBJECT_OPTIONS, facets?.subject)}
        />
        <FilterSelect
          label="학교급"
          value={filters.schoolLevel}
          onChange={handleSchoolLevelChange}
          options={withFacetCount(SCHOOL_LEVEL_OPTIONS, facets?.schoolLevel)}
        />
        <FilterSelect
          label="학년"
          value={filters.grade}
          onChange={(v) => onFilterChange("grade", v)}
          options={gradeOptions}
          placeholder={filters.schoolLevel ? "전체" : "학교급 선택"}
          disabled={!filters.schoolLevel}
        />
        <FilterSelect
          label="문항 유형"
          value={filters.itemType}
          onChange={(v) => onFilterChange("itemType", v)}
          options={withFacetCount(ITEM_TYPE_OPTIONS, facets?.itemType)}
        />
        <FilterSelect
          label="최소 난이도"
          value={filters.difficultyMin}
          onChange={(v) => onFilterChange("difficultyMin", v)}
          options={withFacetCount(DIFFICULTY_LEVEL_OPTIONS, facets?.difficulty)}
        />
        <FilterSelect
          label="최대 난이도"
          value={filters.difficultyMax}
          onChange={(v) => onFilterChange("difficultyMax", v)}
          options={DIFFICULTY_LEVEL_OPTIONS}
        />
        <FilterSelect
          label="활용 목적"
          value={filters.usagePurpose}
          onChange={(v) => onFilterChange("usagePurpose", v)}
          options={USAGE_PURPOSE_OPTIONS}
        />
        {filters.subject === "IT_CERT" && (
          <FilterSelect
            label="코드 언어"
            value={filters.codeLanguage}
            onChange={(v) => onFilterChange("codeLanguage", v)}
            options={withFacetCount(CODE_LANGUAGE_OPTIONS, facets?.codeLanguage)}
          />
        )}
        <FilterSelect
          label="문제 유형"
          value={filters.typeLevel}
          onChange={(v) => onFilterChange("typeLevel", v)}
          options={TYPE_LEVEL_OPTIONS}
        />
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onReset}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
