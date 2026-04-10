import { describe, it, expect } from "vitest";
import {
  extractFormValues,
  buildItemPayload,
  type FormValues,
} from "../item-form-utils";

// --- extractFormValues ---

describe("extractFormValues", () => {
  it("null/undefined → null 반환", () => {
    expect(extractFormValues(null)).toBe(null);
    expect(extractFormValues(undefined)).toBe(null);
  });

  it("정상 아이템에서 모든 폼 값을 추출한다", () => {
    const item = {
      bodyLatex: "x^2 + 1",
      schoolLevel: "middle",
      grade: 2,
      semester: "first",
      itemType: "short_answer",
      formulaType: "inline",
      answerFormat: "expression",
      answer: { value: "x+1", format: "expression" },
      difficultyAuthor: 4,
      solutionSteps: 3,
      usagePurposes: ["diagnosis", "practice"],
    };

    const result = extractFormValues(item);

    expect(result).toEqual({
      bodyLatex: "x^2 + 1",
      schoolLevel: "middle",
      grade: 2,
      semester: "first",
      itemType: "short_answer",
      formulaType: "inline",
      answerFormat: "expression",
      answerValue: "x+1",
      difficultyAuthor: 4,
      solutionSteps: "3",
      usagePurposes: ["diagnosis", "practice"],
    });
  });

  it("answer가 객체가 아니면 빈 문자열", () => {
    const item = { answer: "plain string" };
    const result = extractFormValues(item);
    expect(result?.answerValue).toBe("");
  });

  it("answer.value가 없으면 빈 문자열", () => {
    const item = { answer: { format: "exact_value" } };
    const result = extractFormValues(item);
    expect(result?.answerValue).toBe("");
  });

  it("semester가 first/second 아니면 undefined", () => {
    const item = { semester: null };
    const result = extractFormValues(item);
    expect(result?.semester).toBeUndefined();
  });

  it("difficultyAuthor가 없으면 기본값 3", () => {
    const item = {};
    const result = extractFormValues(item);
    expect(result?.difficultyAuthor).toBe(3);
  });

  it("usagePurposes가 배열이 아니면 빈 배열", () => {
    const item = { usagePurposes: null };
    const result = extractFormValues(item);
    expect(result?.usagePurposes).toEqual([]);
  });
});

// --- buildItemPayload ---

describe("buildItemPayload", () => {
  const baseForm: FormValues = {
    bodyLatex: "2x + 3 = 7",
    schoolLevel: "middle",
    grade: 1,
    semester: "first",
    itemType: "short_answer",
    formulaType: "display",
    answerFormat: "exact_value",
    answerValue: "2",
    difficultyAuthor: 3,
    solutionSteps: "2",
    usagePurposes: ["diagnosis"],
  };

  it("생성 모드: editId 없으면 id/changeSummary 없는 페이로드", () => {
    const payload = buildItemPayload({ formValues: baseForm });

    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("changeSummary");
    expect(payload.bodyLatex).toBe("2x + 3 = 7");
    expect(payload.answer).toEqual({ value: "2", format: "exact_value" });
    expect(payload.solutionSteps).toBe(2);
    expect(payload.usagePurposes).toEqual(["diagnosis"]);
  });

  it("수정 모드: editId가 있으면 id 포함", () => {
    const payload = buildItemPayload({
      formValues: baseForm,
      editId: "item-123",
    });

    expect(payload).toHaveProperty("id", "item-123");
  });

  it("수정 모드: changeSummary가 있으면 포함", () => {
    const payload = buildItemPayload({
      formValues: baseForm,
      editId: "item-123",
      changeSummary: "난이도 수정",
    });

    expect(payload).toHaveProperty("changeSummary", "난이도 수정");
  });

  it("수정 모드: changeSummary가 빈 문자열이면 미포함", () => {
    const payload = buildItemPayload({
      formValues: baseForm,
      editId: "item-123",
      changeSummary: "   ",
    });

    expect(payload).not.toHaveProperty("changeSummary");
  });

  it("solutionSteps 빈 문자열이면 undefined", () => {
    const payload = buildItemPayload({
      formValues: { ...baseForm, solutionSteps: "" },
    });

    expect(payload.solutionSteps).toBeUndefined();
  });

  it("usagePurposes 빈 배열이면 undefined", () => {
    const payload = buildItemPayload({
      formValues: { ...baseForm, usagePurposes: [] },
    });

    expect(payload.usagePurposes).toBeUndefined();
  });

  it("difficultyAuthor 0이면 undefined", () => {
    const payload = buildItemPayload({
      formValues: { ...baseForm, difficultyAuthor: 0 },
    });

    expect(payload.difficultyAuthor).toBeUndefined();
  });
});
