"use client";

import React, { useState, useCallback, useEffect, useRef, Suspense, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { FormulaEditor } from "@/components/math/formula-editor";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  SCHOOL_LEVEL_OPTIONS,
  ITEM_TYPE_OPTIONS,
  FORMULA_TYPE_OPTIONS,
  ANSWER_FORMAT_OPTIONS,
  USAGE_PURPOSE_OPTIONS,
  DIFFICULTY_LEVEL_OPTIONS,
  GRADE_BY_LEVEL,
  type SchoolLevelKey,
} from "@math-item-os/shared/constants/index";
import { extractFormValues } from "./item-form-utils";
import { AutoTagSuggestions } from "@/components/items/auto-tag-suggestions";
import type { AuthoringOutput } from "@/components/math/authoring";

// MathLive는 SSR 불가 — 클라이언트 전용 dynamic import
const ItemAuthoringGrid = dynamic(
  () => import("@/components/math/authoring").then((m) => ({ default: m.ItemAuthoringGrid })),
  { ssr: false, loading: () => <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">저작 도구 로딩 중...</div> },
);

type EditorTab = "classic" | "authoring";

// --- 타입 정의 ---

interface FormErrors {
  bodyLatex?: string;
  schoolLevel?: string;
  grade?: string;
  itemType?: string;
  answerFormat?: string;
  answerValue?: string;
}

type SchoolLevel = SchoolLevelKey;
type Semester = "first" | "second" | undefined;

// --- 학기 옵션 ---

const SEMESTER_OPTIONS = [
  { value: "first", label: "1학기" },
  { value: "second", label: "2학기" },
] as const;

// --- 유틸 ---

/** 학교급에 따른 학년 옵션 생성 */
function getGradeOptions(schoolLevel: SchoolLevel): readonly number[] {
  return GRADE_BY_LEVEL[schoolLevel];
}

/** 필수 필드 유효성 검사 */
function validateForm(state: {
  bodyLatex: string;
  schoolLevel: SchoolLevel;
  grade: number;
  itemType: string;
  answerFormat: string;
  answerValue: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!state.bodyLatex.trim()) {
    errors.bodyLatex = "수식 본문을 입력해 주세요.";
  }
  if (!state.schoolLevel) {
    errors.schoolLevel = "학교급을 선택해 주세요.";
  }
  if (!state.grade) {
    errors.grade = "학년을 선택해 주세요.";
  }
  if (!state.itemType) {
    errors.itemType = "문항 유형을 선택해 주세요.";
  }
  if (!state.answerFormat) {
    errors.answerFormat = "정답 형식을 선택해 주세요.";
  }
  if (!state.answerValue.trim()) {
    errors.answerValue = "정답을 입력해 주세요.";
  }

  return errors;
}

// --- 공용 폼 컨트롤 ---

function FormSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </legend>
      <div className="mt-2 flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
}: Readonly<{
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}>) {
  const id = React.useId();
  const fieldId = `select-${id}`;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`h-9 rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-500 ${
          error ? "border-red-400" : "border-slate-200 dark:border-slate-700"
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p id={errorId} className="text-sm text-red-500" role="alert">{error}</p>}
    </div>
  );
}

// --- 메인 페이지 컴포넌트 ---

export default function ItemCreatePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center"><p className="text-sm text-slate-400 dark:text-slate-500">로딩 중...</p></div>}>
      <ItemForm />
    </Suspense>
  );
}

function ItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = editId !== null;

  // -- 폼 상태 --
  const [bodyLatex, setBodyLatex] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("middle");
  const [grade, setGrade] = useState<number>(1);
  const [semester, setSemester] = useState<Semester>(undefined);
  const [itemType, setItemType] = useState("multiple_choice");
  const [formulaType, setFormulaType] = useState("display");
  const [answerFormat, setAnswerFormat] = useState("exact_value");
  const [answerValue, setAnswerValue] = useState("");
  const [difficultyAuthor, setDifficultyAuthor] = useState<number>(3);
  const [solutionSteps, setSolutionSteps] = useState<string>("");
  const [usagePurposes, setUsagePurposes] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([]);
  const [selectedMisconceptionIds, setSelectedMisconceptionIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [changeSummary, setChangeSummary] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("authoring");
  const authoringOutputRef = useRef<AuthoringOutput | null>(null);

  // -- 편집 모드: 기존 문항 로드 --
  const { data: existingItem, isLoading: isLoadingItem } = trpc.item.getById.useQuery(
    { id: editId! },
    { enabled: isEditMode },
  );

  useEffect(() => {
    if (!existingItem || initialized) return;
    const vals = extractFormValues(existingItem);
    if (!vals) return;
    setBodyLatex(vals.bodyLatex);
    setSchoolLevel(vals.schoolLevel as SchoolLevel);
    setGrade(vals.grade);
    setSemester(vals.semester as Semester);
    setItemType(vals.itemType);
    setFormulaType(vals.formulaType);
    setAnswerFormat(vals.answerFormat);
    setAnswerValue(vals.answerValue);
    setDifficultyAuthor(vals.difficultyAuthor);
    setSolutionSteps(vals.solutionSteps);
    setUsagePurposes(vals.usagePurposes);
    if (existingItem.skills) {
      setSelectedSkillIds(existingItem.skills.map((s: any) => s.skillId));
    }
    if (existingItem.standards) {
      setSelectedStandardIds(existingItem.standards.map((s: any) => s.standardId));
    }
    if (existingItem.misconceptions) {
      setSelectedMisconceptionIds(existingItem.misconceptions.map((m: any) => m.misconceptionId));
    }
    setInitialized(true);
  }, [existingItem, initialized]);

  // -- tRPC mutation --
  const createItem = trpc.item.create.useMutation({
    onSuccess: (data) => {
      // CreateItemResult: { item, conversionResult }
      const itemId = data.item?.id;
      if (itemId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/items/${itemId}` as any);
      }
    },
  });

  const updateItem = trpc.item.update.useMutation({
    onSuccess: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/items/${editId}` as any);
    },
  });

  // -- 학교급 변경 시 학년 초기화 --
  const handleSchoolLevelChange = useCallback((value: string) => {
    const level = value as SchoolLevel;
    setSchoolLevel(level);
    setGrade(1);
  }, []);

  // -- 메타데이터 태그 토글 --
  const handleSkillToggle = useCallback((id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleStandardToggle = useCallback((id: string) => {
    setSelectedStandardIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleMisconceptionToggle = useCallback((id: string) => {
    setSelectedMisconceptionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // -- 저작 도구 출력 → bodyLatex 동기화 --
  const handleAuthoringOutput = useCallback((output: AuthoringOutput) => {
    authoringOutputRef.current = output;
    if (editorTab === "authoring") {
      setBodyLatex(output.bodyLatex);
    }
  }, [editorTab]);

  // -- 활용 목적 토글 --
  const handleUsagePurposeToggle = useCallback((purpose: string) => {
    setUsagePurposes((prev) =>
      prev.includes(purpose)
        ? prev.filter((p) => p !== purpose)
        : [...prev, purpose],
    );
  }, []);

  // -- 제출 처리 --
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      // 클라이언트 유효성 검사
      const validationErrors = validateForm({
        bodyLatex,
        schoolLevel,
        grade,
        itemType,
        answerFormat,
        answerValue,
      });

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});

      const payload = {
        bodyLatex,
        schoolLevel,
        grade,
        semester,
        itemType: itemType as
          | "multiple_choice"
          | "short_answer"
          | "essay"
          | "fill_in_blank"
          | "true_false",
        formulaType: formulaType as
          | "inline"
          | "display"
          | "mixed"
          | "none",
        answerFormat: answerFormat as
          | "exact_value"
          | "expression"
          | "multiple_choice"
          | "range"
          | "set",
        answer: {
          value: answerValue,
          format: answerFormat,
        },
        difficultyAuthor: difficultyAuthor || undefined,
        solutionSteps: solutionSteps ? Number(solutionSteps) : undefined,
        usagePurposes:
          usagePurposes.length > 0
            ? (usagePurposes as (
                | "diagnosis"
                | "remediation"
                | "pre_exam"
                | "advanced"
                | "practice"
                | "review"
              )[])
            : undefined,
        skillIds: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
        standardIds: selectedStandardIds.length > 0 ? selectedStandardIds : undefined,
        misconceptionIds: selectedMisconceptionIds.length > 0 ? selectedMisconceptionIds : undefined,
      };

      if (isEditMode) {
        updateItem.mutate({
          id: editId!,
          ...payload,
          ...(changeSummary.trim() && { changeSummary: changeSummary.trim() }),
        });
      } else {
        createItem.mutate(payload);
      }
    },
    [
      bodyLatex,
      schoolLevel,
      grade,
      semester,
      itemType,
      formulaType,
      answerFormat,
      answerValue,
      difficultyAuthor,
      solutionSteps,
      usagePurposes,
      selectedSkillIds,
      selectedStandardIds,
      selectedMisconceptionIds,
      changeSummary,
      isEditMode,
      editId,
      createItem,
      updateItem,
    ],
  );

  const gradeOptions = getGradeOptions(schoolLevel);
  const isPending = isEditMode ? updateItem.isPending : createItem.isPending;
  const mutationError = isEditMode ? updateItem.error : createItem.error;

  if (isEditMode && isLoadingItem) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">문항 데이터 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEditMode ? "문항 수정" : "문항 등록"}
        </h1>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          href={(isEditMode ? `/items/${editId}` : "/items") as any}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          취소
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 수식 영역 — 탭 토글 */}
        <FormSection title="수식 영역">
          {/* 탭 헤더 */}
          <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setEditorTab("authoring")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                editorTab === "authoring"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              저작 도구
            </button>
            <button
              type="button"
              onClick={() => setEditorTab("classic")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                editorTab === "classic"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              LaTeX 직접 입력
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          {editorTab === "authoring" ? (
            <ItemAuthoringGrid onOutputChange={handleAuthoringOutput} />
          ) : (
            <FormulaEditor
              value={bodyLatex}
              onChange={setBodyLatex}
              label="수식"
              error={errors.bodyLatex}
            />
          )}

          {errors.bodyLatex && editorTab === "authoring" && (
            <p className="text-sm text-red-500" role="alert">{errors.bodyLatex}</p>
          )}
        </FormSection>

        {/* 기본 정보 */}
        <FormSection title="기본 정보">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="학교급"
              value={schoolLevel}
              onChange={handleSchoolLevelChange}
              options={SCHOOL_LEVEL_OPTIONS}
              error={errors.schoolLevel}
            />
            <SelectField
              label="학년"
              value={grade}
              onChange={(v) => setGrade(Number(v))}
              options={gradeOptions.map((g) => ({
                value: g,
                label: `${g}학년`,
              }))}
              error={errors.grade}
            />
            <SelectField
              label="학기 (선택)"
              value={semester ?? ""}
              onChange={(v) =>
                setSemester(v ? (v as "first" | "second") : undefined)
              }
              options={SEMESTER_OPTIONS}
              placeholder="선택 안함"
            />
            <SelectField
              label="문항 유형"
              value={itemType}
              onChange={setItemType}
              options={ITEM_TYPE_OPTIONS}
              error={errors.itemType}
            />
          </div>
        </FormSection>

        {/* 메타데이터 자동 추천 */}
        <AutoTagSuggestions
          bodyLatex={bodyLatex}
          schoolLevel={schoolLevel}
          grade={grade}
          itemType={itemType}
          formulaType={formulaType}
          solutionSteps={solutionSteps ? Number(solutionSteps) : undefined}
          selectedSkillIds={selectedSkillIds}
          selectedStandardIds={selectedStandardIds}
          selectedMisconceptionIds={selectedMisconceptionIds}
          onSkillSelect={handleSkillToggle}
          onStandardSelect={handleStandardToggle}
          onMisconceptionSelect={handleMisconceptionToggle}
        />

        {/* 수식 설정 */}
        <FormSection title="수식 설정">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="수식 유형"
              value={formulaType}
              onChange={setFormulaType}
              options={FORMULA_TYPE_OPTIONS}
            />
            <SelectField
              label="정답 형식"
              value={answerFormat}
              onChange={setAnswerFormat}
              options={ANSWER_FORMAT_OPTIONS}
              error={errors.answerFormat}
            />
          </div>
        </FormSection>

        {/* 정답 */}
        <FormSection title="정답">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="answer-value" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                정답 값
              </label>
              <input
                id="answer-value"
                type="text"
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="정답을 입력하세요"
                aria-describedby={errors.answerValue ? "answer-value-error" : undefined}
                aria-invalid={errors.answerValue ? true : undefined}
                className={`h-9 rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-500 ${
                  errors.answerValue ? "border-red-400" : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {errors.answerValue && (
                <p id="answer-value-error" className="text-sm text-red-500" role="alert">{errors.answerValue}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="answer-format-display" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                정답 형식
              </label>
              <input
                id="answer-format-display"
                type="text"
                value={
                  ANSWER_FORMAT_OPTIONS.find(
                    (o: { value: string; label: string }) =>
                      o.value === answerFormat,
                  )?.label ?? answerFormat
                }
                readOnly
                className="h-9 cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>
          </div>
        </FormSection>

        {/* 난이도 */}
        <FormSection title="난이도">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              출제자 난이도
            </label>
            <div className="flex gap-3">
              {DIFFICULTY_LEVEL_OPTIONS.map((opt: { value: number; label: string }) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="difficultyAuthor"
                    value={opt.value}
                    checked={difficultyAuthor === opt.value}
                    onChange={() => setDifficultyAuthor(opt.value)}
                    className="h-4 w-4 accent-slate-900 dark:accent-slate-300"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </FormSection>

        {/* 추가 설정 */}
        <FormSection title="추가 설정">
          {/* 풀이 단계 수 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="solution-steps" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              풀이 단계 수 (선택)
            </label>
            <input
              id="solution-steps"
              type="number"
              min={1}
              value={solutionSteps}
              onChange={(e) => setSolutionSteps(e.target.value)}
              placeholder="예: 3"
              className="h-9 w-32 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-500"
            />
          </div>

          {/* 활용 목적 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              활용 목적 (선택, 복수 가능)
            </label>
            <div className="flex flex-wrap gap-3">
              {USAGE_PURPOSE_OPTIONS.map((opt: { value: string; label: string }) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="checkbox"
                    checked={usagePurposes.includes(opt.value)}
                    onChange={() => handleUsagePurposeToggle(opt.value)}
                    className="h-4 w-4 accent-slate-900 dark:accent-slate-300"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </FormSection>

        {/* 변경 사유 (편집 모드에서만 표시) */}
        {isEditMode && (
          <div className="flex flex-col gap-1">
            <label htmlFor="change-summary" className="text-sm font-medium text-slate-700 dark:text-slate-300">변경 사유</label>
            <input
              id="change-summary"
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="변경 사유를 입력해 주세요 (선택)"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-500"
            />
          </div>
        )}

        {/* tRPC 에러 표시 */}
        {mutationError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950" role="alert">
            <p className="text-sm text-red-700 dark:text-red-400">
              {mutationError.message}
            </p>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={(isEditMode ? `/items/${editId}` : "/items") as any}>
            <Button type="button" variant="outline">
              취소
            </Button>
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? (isEditMode ? "저장 중..." : "등록 중...")
              : (isEditMode ? "저장" : "등록")}
          </Button>
        </div>
      </form>
    </div>
  );
}
