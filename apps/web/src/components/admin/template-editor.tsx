"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── 타입 정의 ───

interface ParameterFormData {
  readonly name: string;
  readonly type: "integer" | "float";
  readonly min: number;
  readonly max: number;
  readonly constraints: readonly string[];
}

interface TemplateFormData {
  readonly title: string;
  readonly bodyTemplate: string;
  readonly parameters: ReadonlyArray<ParameterFormData>;
  readonly answerTemplate: string;
  readonly constraints: Record<string, boolean>;
}

interface TemplateEditorProps {
  readonly onSave: (template: TemplateFormData) => void;
  readonly initialData?: TemplateFormData | null;
  readonly isLoading?: boolean;
}

// ─── 상수 ───

const PARAMETER_TYPES = [
  { value: "integer", label: "정수" },
  { value: "float", label: "실수" },
] as const;

const PARAMETER_CONSTRAINTS = [
  { value: "nonzero", label: "0 제외" },
  { value: "positive", label: "양수" },
  { value: "negative", label: "음수" },
  { value: "odd", label: "홀수" },
  { value: "even", label: "짝수" },
] as const;

const TEMPLATE_CONSTRAINTS = [
  { key: "integer_solution", label: "정수 해 보장" },
  { key: "positive_answer", label: "양수 정답" },
  { key: "negative_answer", label: "음수 정답" },
  { key: "nonzero_answer", label: "0이 아닌 정답" },
  { key: "no_zero_denominator", label: "분모 0 방지" },
] as const;

/** bodyTemplate에서 {{변수명}} 패턴 추출 */
const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

const DEFAULT_PARAMETER: ParameterFormData = {
  name: "",
  type: "integer",
  min: 1,
  max: 10,
  constraints: [],
};

const DEFAULT_FORM_DATA: TemplateFormData = {
  title: "",
  bodyTemplate: "",
  parameters: [],
  answerTemplate: "",
  constraints: {},
};

// ─── 유틸리티 ───

/** bodyTemplate 텍스트에서 매개변수 이름 목록 추출 */
function extractPlaceholders(template: string): readonly string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  // PLACEHOLDER_REGEX는 전역이므로 매번 lastIndex 초기화
  const regex = new RegExp(PLACEHOLDER_REGEX.source, "g");
  match = regex.exec(template);
  while (match !== null) {
    matches.add(match[1]);
    match = regex.exec(template);
  }
  return [...matches];
}

// ─── 매개변수 제약조건 체크박스 ───

const ParameterConstraintCheckboxes = memo(function ParameterConstraintCheckboxes({
  selected,
  onChange,
}: {
  readonly selected: readonly string[];
  readonly onChange: (constraints: readonly string[]) => void;
}) {
  const handleToggle = useCallback(
    (value: string) => {
      const isSelected = selected.includes(value);
      const updated = isSelected
        ? selected.filter((c) => c !== value)
        : [...selected, value];
      onChange(updated);
    },
    [selected, onChange],
  );

  return (
    <div className="flex flex-wrap gap-2">
      {PARAMETER_CONSTRAINTS.map((constraint) => {
        const isChecked = selected.includes(constraint.value);
        return (
          <label
            key={constraint.value}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
              isChecked
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300",
            )}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggle(constraint.value)}
              className="sr-only"
            />
            {constraint.label}
          </label>
        );
      })}
    </div>
  );
});

// ─── 개별 매개변수 행 ───

interface ParameterRowProps {
  readonly parameter: ParameterFormData;
  readonly index: number;
  readonly onChange: (index: number, updated: ParameterFormData) => void;
  readonly onRemove: (index: number) => void;
}

const ParameterRow = memo(function ParameterRow({
  parameter,
  index,
  onChange,
  onRemove,
}: ParameterRowProps) {
  const handleFieldChange = useCallback(
    (field: keyof ParameterFormData, value: string | number | readonly string[]) => {
      const updated: ParameterFormData = { ...parameter, [field]: value };
      onChange(index, updated);
    },
    [parameter, index, onChange],
  );

  const handleConstraintsChange = useCallback(
    (constraints: readonly string[]) => {
      handleFieldChange("constraints", constraints);
    },
    [handleFieldChange],
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(index);
  }, [onRemove, index]);

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      {/* 상단: 이름, 타입, 범위, 삭제 버튼 */}
      <div className="flex flex-wrap items-end gap-2">
        {/* 변수명 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">변수명</span>
          <input
            type="text"
            value={parameter.name}
            onChange={(e) => handleFieldChange("name", e.target.value)}
            placeholder="a"
            className={cn(
              "h-8 w-24 rounded-md border border-slate-200 px-2 text-sm font-mono",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
              "placeholder:text-slate-400",
            )}
          />
        </div>

        {/* 타입 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">타입</span>
          <select
            value={parameter.type}
            onChange={(e) => handleFieldChange("type", e.target.value)}
            className={cn(
              "h-8 w-24 rounded-md border border-slate-200 px-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            )}
          >
            {PARAMETER_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 최솟값 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">최솟값</span>
          <input
            type="number"
            value={parameter.min}
            onChange={(e) => handleFieldChange("min", Number(e.target.value))}
            className={cn(
              "h-8 w-20 rounded-md border border-slate-200 px-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            )}
          />
        </div>

        {/* 최댓값 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">최댓값</span>
          <input
            type="number"
            value={parameter.max}
            onChange={(e) => handleFieldChange("max", Number(e.target.value))}
            className={cn(
              "h-8 w-20 rounded-md border border-slate-200 px-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            )}
          />
        </div>

        {/* 삭제 버튼 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemoveClick}
          className="h-8 text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 하단: 제약조건 체크박스 */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-slate-500">제약조건</span>
        <ParameterConstraintCheckboxes
          selected={parameter.constraints}
          onChange={handleConstraintsChange}
        />
      </div>
    </div>
  );
});

// ─── 누락 매개변수 알림 ───

interface MissingParametersNoticeProps {
  readonly missingNames: readonly string[];
  readonly onAddAll: () => void;
}

const MissingParametersNotice = memo(function MissingParametersNotice({
  missingNames,
  onAddAll,
}: MissingParametersNoticeProps) {
  if (missingNames.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      <p className="flex-1 text-xs text-amber-700">
        본문에 사용된 매개변수 중 미등록 항목:{" "}
        <span className="font-mono font-medium">
          {missingNames.join(", ")}
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddAll}
        className="h-7 text-xs"
      >
        모두 추가
      </Button>
    </div>
  );
});

// ─── 템플릿 제약조건 섹션 ───

interface TemplateConstraintsSectionProps {
  readonly constraints: Record<string, boolean>;
  readonly onChange: (constraints: Record<string, boolean>) => void;
}

const TemplateConstraintsSection = memo(function TemplateConstraintsSection({
  constraints,
  onChange,
}: TemplateConstraintsSectionProps) {
  const handleToggle = useCallback(
    (key: string) => {
      const updated = { ...constraints, [key]: !constraints[key] };
      onChange(updated);
    },
    [constraints, onChange],
  );

  return (
    <div className="flex flex-wrap gap-3">
      {TEMPLATE_CONSTRAINTS.map((constraint) => {
        const isChecked = !!constraints[constraint.key];
        return (
          <label
            key={constraint.key}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggle(constraint.key)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {constraint.label}
          </label>
        );
      })}
    </div>
  );
});

// ─── 메인 컴포넌트 ───

export function TemplateEditor({
  onSave,
  initialData,
  isLoading = false,
}: TemplateEditorProps) {
  const [formData, setFormData] = useState<TemplateFormData>(
    initialData ?? DEFAULT_FORM_DATA,
  );

  // bodyTemplate에서 감지한 변수명 목록
  const detectedPlaceholders = useMemo(
    () => extractPlaceholders(formData.bodyTemplate),
    [formData.bodyTemplate],
  );

  // 현재 매개변수에 등록되지 않은 변수명
  const existingParamNames = useMemo(
    () => new Set(formData.parameters.map((p) => p.name)),
    [formData.parameters],
  );

  const missingParamNames = useMemo(
    () => detectedPlaceholders.filter((name) => !existingParamNames.has(name)),
    [detectedPlaceholders, existingParamNames],
  );

  // ── 필드 업데이트 핸들러 ──

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, title: e.target.value }));
    },
    [],
  );

  const handleBodyTemplateChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, bodyTemplate: e.target.value }));
    },
    [],
  );

  const handleAnswerTemplateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, answerTemplate: e.target.value }));
    },
    [],
  );

  const handleConstraintsChange = useCallback(
    (constraints: Record<string, boolean>) => {
      setFormData((prev) => ({ ...prev, constraints }));
    },
    [],
  );

  // ── 매개변수 CRUD 핸들러 ──

  const handleAddParameter = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      parameters: [...prev.parameters, DEFAULT_PARAMETER],
    }));
  }, []);

  const handleParameterChange = useCallback(
    (index: number, updated: ParameterFormData) => {
      setFormData((prev) => ({
        ...prev,
        parameters: prev.parameters.map((p, i) => (i === index ? updated : p)),
      }));
    },
    [],
  );

  const handleParameterRemove = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  }, []);

  /** 누락된 매개변수를 모두 기본값으로 추가 */
  const handleAddMissingParameters = useCallback(() => {
    const newParams: ParameterFormData[] = missingParamNames.map((name) => ({
      ...DEFAULT_PARAMETER,
      name,
    }));
    setFormData((prev) => ({
      ...prev,
      parameters: [...prev.parameters, ...newParams],
    }));
  }, [missingParamNames]);

  // ── 저장 핸들러 ──

  const handleSave = useCallback(() => {
    onSave(formData);
  }, [onSave, formData]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 템플릿 제목 */}
      <section className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          템플릿 제목
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={handleTitleChange}
          placeholder="예: 일차방정식 기본형"
          className={cn(
            "h-9 w-full rounded-md border border-slate-200 px-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            "placeholder:text-slate-400",
          )}
        />
      </section>

      {/* 2. 본문 템플릿 */}
      <section className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          본문 템플릿 (LaTeX)
        </label>
        <textarea
          value={formData.bodyTemplate}
          onChange={handleBodyTemplateChange}
          placeholder="{{a}}(x-{{b}})={{c}}"
          spellCheck={false}
          rows={4}
          className={cn(
            "w-full resize-y rounded-md border border-slate-200 p-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            "placeholder:text-slate-400",
          )}
        />
        <p className="text-xs text-slate-400">
          {"{{변수명}}"} 형식으로 매개변수를 삽입하세요. 예: {"{{a}}"}(x-{"{{b}}"})={"{{c}}"}
        </p>
      </section>

      {/* 3. 매개변수 정의 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            매개변수 정의
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddParameter}
          >
            <Plus className="h-4 w-4" />
            매개변수 추가
          </Button>
        </div>

        {/* 누락 매개변수 알림 */}
        <MissingParametersNotice
          missingNames={missingParamNames}
          onAddAll={handleAddMissingParameters}
        />

        {/* 매개변수 목록 */}
        {formData.parameters.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            등록된 매개변수가 없습니다. 본문에 {"{{변수명}}"} 을 입력하면 자동으로 감지됩니다.
          </p>
        ) : (
          <div className="space-y-2">
            {formData.parameters.map((param, index) => (
              <ParameterRow
                key={`param-${index}`}
                parameter={param}
                index={index}
                onChange={handleParameterChange}
                onRemove={handleParameterRemove}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. 정답 수식 */}
      <section className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          정답 수식
        </label>
        <input
          type="text"
          value={formData.answerTemplate}
          onChange={handleAnswerTemplateChange}
          placeholder="c/a + b"
          spellCheck={false}
          className={cn(
            "h-9 w-full rounded-md border border-slate-200 px-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            "placeholder:text-slate-400",
          )}
        />
        <p className="text-xs text-slate-400">
          매개변수를 사용한 정답 수식. 예: c/a + b
        </p>
      </section>

      {/* 5. 검증 제약조건 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          검증 제약조건
        </label>
        <TemplateConstraintsSection
          constraints={formData.constraints}
          onChange={handleConstraintsChange}
        />
      </section>

      {/* 6. 저장 버튼 */}
      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="min-w-[100px]"
        >
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}

export type { TemplateEditorProps, TemplateFormData, ParameterFormData };
