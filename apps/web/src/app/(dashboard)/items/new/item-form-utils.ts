// 문항 폼 순수 로직 (테스트 대상)
// useEffect/mutation 없이 데이터 변환만 담당

// --- 타입 ---

export interface FormValues {
  readonly bodyLatex: string;
  readonly schoolLevel: string;
  readonly grade: number;
  readonly semester: string | undefined;
  readonly itemType: string;
  readonly formulaType: string;
  readonly answerFormat: string;
  readonly answerValue: string;
  readonly difficultyAuthor: number;
  readonly solutionSteps: string;
  readonly usagePurposes: string[];
}

// --- 기존 아이템 → 폼 초기값 추출 ---

export function extractFormValues(item: unknown): FormValues | null {
  if (!item || typeof item !== "object") return null;

  const rec = item as Record<string, unknown>;

  const answerValue = extractAnswerValue(rec.answer);

  return {
    bodyLatex: typeof rec.bodyLatex === "string" ? rec.bodyLatex : "",
    schoolLevel: typeof rec.schoolLevel === "string" ? rec.schoolLevel : "middle",
    grade: typeof rec.grade === "number" ? rec.grade : 1,
    semester:
      rec.semester === "first" || rec.semester === "second"
        ? rec.semester
        : undefined,
    itemType: typeof rec.itemType === "string" ? rec.itemType : "multiple_choice",
    formulaType: typeof rec.formulaType === "string" ? rec.formulaType : "display",
    answerFormat: typeof rec.answerFormat === "string" ? rec.answerFormat : "exact_value",
    answerValue,
    difficultyAuthor:
      typeof rec.difficultyAuthor === "number" ? rec.difficultyAuthor : 3,
    solutionSteps:
      rec.solutionSteps != null ? String(rec.solutionSteps) : "",
    usagePurposes: Array.isArray(rec.usagePurposes) ? rec.usagePurposes : [],
  };
}

function extractAnswerValue(answer: unknown): string {
  if (typeof answer === "object" && answer !== null) {
    const val = (answer as Record<string, unknown>).value;
    return typeof val === "string" ? val : "";
  }
  return "";
}

// --- 폼 상태 → 페이로드 빌드 ---

export interface BuildPayloadInput {
  readonly formValues: FormValues;
  readonly editId?: string;
  readonly changeSummary?: string;
}

export function buildItemPayload(input: BuildPayloadInput) {
  const { formValues: f, editId, changeSummary } = input;

  const base = {
    bodyLatex: f.bodyLatex,
    schoolLevel: f.schoolLevel,
    grade: f.grade,
    semester: f.semester,
    itemType: f.itemType,
    formulaType: f.formulaType,
    answerFormat: f.answerFormat,
    answer: { value: f.answerValue, format: f.answerFormat },
    difficultyAuthor: f.difficultyAuthor || undefined,
    solutionSteps: f.solutionSteps ? Number(f.solutionSteps) : undefined,
    usagePurposes: f.usagePurposes.length > 0 ? f.usagePurposes : undefined,
  };

  if (editId) {
    return {
      ...base,
      id: editId,
      ...(changeSummary?.trim() ? { changeSummary: changeSummary.trim() } : {}),
    };
  }

  return base;
}
