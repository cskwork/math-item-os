// 채점 서비스 단위 테스트
import { describe, it, expect } from "vitest";
import { gradeResponse, normalizeAnswer } from "../grading.service";

// -------------------------------------------------
// normalizeAnswer
// -------------------------------------------------

describe("normalizeAnswer", () => {
  it("앞뒤 공백을 제거한다", () => {
    expect(normalizeAnswer("  hello  ")).toBe("hello");
  });

  it("소문자로 변환한다", () => {
    expect(normalizeAnswer("Hello World")).toBe("hello world");
  });

  it("연속 공백을 단일 공백으로 축소한다", () => {
    expect(normalizeAnswer("a   b   c")).toBe("a b c");
  });

  it("앞뒤 공백 + 소문자 + 연속 공백을 동시에 처리한다", () => {
    expect(normalizeAnswer("  Hello   WORLD  ")).toBe("hello world");
  });

  it("빈 문자열을 반환한다", () => {
    expect(normalizeAnswer("")).toBe("");
  });
});

// -------------------------------------------------
// gradeResponse
// -------------------------------------------------

describe("gradeResponse", () => {
  // 헬퍼: studentAnswer JSON 래퍼
  const ans = (value: string) => ({ value });

  // -----------------------------------------------
  // multiple_choice
  // -----------------------------------------------
  describe("multiple_choice", () => {
    const choices = [
      { label: "A", isCorrect: false },
      { label: "B", isCorrect: true },
      { label: "C", isCorrect: false },
    ];

    it("정답 선택지를 고르면 correct", () => {
      const result = gradeResponse(ans("B"), {
        itemType: "multiple_choice",
        answer: null,
        choices,
      }, 2);
      expect(result).toEqual({ result: "correct", score: 2, maxScore: 2 });
    });

    it("오답 선택지를 고르면 incorrect", () => {
      const result = gradeResponse(ans("A"), {
        itemType: "multiple_choice",
        answer: null,
        choices,
      }, 2);
      expect(result).toEqual({ result: "incorrect", score: 0, maxScore: 2 });
    });

    it("대소문자 무시: 'b'를 입력해도 correct", () => {
      const result = gradeResponse(ans("b"), {
        itemType: "multiple_choice",
        answer: null,
        choices,
      }, 1);
      expect(result).toEqual({ result: "correct", score: 1, maxScore: 1 });
    });

    it("choices가 배열이 아니면 incorrect", () => {
      const result = gradeResponse(ans("B"), {
        itemType: "multiple_choice",
        answer: null,
        choices: "invalid",
      }, 1);
      expect(result).toEqual({ result: "incorrect", score: 0, maxScore: 1 });
    });

    it("정답 선택지가 없으면 incorrect", () => {
      const noCorrect = [
        { label: "A", isCorrect: false },
        { label: "B", isCorrect: false },
      ];
      const result = gradeResponse(ans("A"), {
        itemType: "multiple_choice",
        answer: null,
        choices: noCorrect,
      }, 1);
      expect(result).toEqual({ result: "incorrect", score: 0, maxScore: 1 });
    });
  });

  // -----------------------------------------------
  // short_answer
  // -----------------------------------------------
  describe("short_answer", () => {
    const item = (value: string, alternatives?: string[]) => ({
      itemType: "short_answer" as const,
      answer: { value, alternatives },
      choices: null,
    });

    it("정확히 일치하면 correct", () => {
      const result = gradeResponse(ans("42"), item("42"), 1);
      expect(result.result).toBe("correct");
    });

    it("대소문자 무시하여 일치하면 correct", () => {
      const result = gradeResponse(ans("hello"), item("HELLO"), 1);
      expect(result.result).toBe("correct");
    });

    it("alternatives에 일치하면 correct", () => {
      const result = gradeResponse(
        ans("pi"),
        item("π", ["pi", "3.14"]),
        1,
      );
      expect(result.result).toBe("correct");
    });

    it("정답도 alternatives도 아니면 incorrect", () => {
      const result = gradeResponse(
        ans("wrong"),
        item("correct", ["also_correct"]),
        1,
      );
      expect(result.result).toBe("incorrect");
    });

    it("answer.value가 없으면 incorrect", () => {
      const result = gradeResponse(ans("anything"), {
        itemType: "short_answer",
        answer: {} as never,
        choices: null,
      }, 1);
      expect(result.result).toBe("incorrect");
    });
  });

  // -----------------------------------------------
  // true_false
  // -----------------------------------------------
  describe("true_false", () => {
    const tfItem = (value: string) => ({
      itemType: "true_false" as const,
      answer: { value },
      choices: null,
    });

    it("true/true -> correct", () => {
      const result = gradeResponse(ans("true"), tfItem("true"), 1);
      expect(result.result).toBe("correct");
    });

    it("false/false -> correct", () => {
      const result = gradeResponse(ans("false"), tfItem("false"), 1);
      expect(result.result).toBe("correct");
    });

    it("true/false -> incorrect", () => {
      const result = gradeResponse(ans("true"), tfItem("false"), 1);
      expect(result.result).toBe("incorrect");
    });

    it("한글 '참'도 true로 인식된다", () => {
      const result = gradeResponse(ans("참"), tfItem("true"), 1);
      expect(result.result).toBe("correct");
    });

    it("한글 '거짓'도 false로 인식된다", () => {
      const result = gradeResponse(ans("거짓"), tfItem("false"), 1);
      expect(result.result).toBe("correct");
    });

    it("'o'는 true로, 'x'는 false로 인식된다", () => {
      expect(gradeResponse(ans("o"), tfItem("true"), 1).result).toBe("correct");
      expect(gradeResponse(ans("x"), tfItem("false"), 1).result).toBe("correct");
    });

    it("'1'은 true로, '0'은 false로 인식된다", () => {
      expect(gradeResponse(ans("1"), tfItem("true"), 1).result).toBe("correct");
      expect(gradeResponse(ans("0"), tfItem("false"), 1).result).toBe("correct");
    });
  });

  // -----------------------------------------------
  // fill_in_blank
  // -----------------------------------------------
  describe("fill_in_blank", () => {
    it("정확히 일치하면 correct", () => {
      const result = gradeResponse(ans("answer"), {
        itemType: "fill_in_blank",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result.result).toBe("correct");
    });

    it("공백 제거 후 일치하면 correct", () => {
      const result = gradeResponse(ans("  answer  "), {
        itemType: "fill_in_blank",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result.result).toBe("correct");
    });

    it("불일치하면 incorrect", () => {
      const result = gradeResponse(ans("wrong"), {
        itemType: "fill_in_blank",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result.result).toBe("incorrect");
    });
  });

  // -----------------------------------------------
  // expression (MVP: 문자열 비교)
  // -----------------------------------------------
  describe("expression", () => {
    it("문자열이 일치하면 correct", () => {
      const result = gradeResponse(ans("x^2 + 1"), {
        itemType: "expression",
        answer: { value: "x^2 + 1" },
        choices: null,
      }, 1);
      expect(result.result).toBe("correct");
    });

    it("문자열이 불일치하면 incorrect", () => {
      const result = gradeResponse(ans("x^2 + 2"), {
        itemType: "expression",
        answer: { value: "x^2 + 1" },
        choices: null,
      }, 1);
      expect(result.result).toBe("incorrect");
    });
  });

  // -----------------------------------------------
  // essay
  // -----------------------------------------------
  describe("essay", () => {
    it("항상 partial을 반환한다 (수동 채점 필요)", () => {
      const result = gradeResponse(ans("긴 서술형 답안입니다."), {
        itemType: "essay",
        answer: null,
        choices: null,
      }, 5);
      expect(result).toEqual({ result: "partial", score: 0, maxScore: 5 });
    });
  });

  // -----------------------------------------------
  // 엣지 케이스
  // -----------------------------------------------
  describe("엣지 케이스", () => {
    it("studentAnswer가 null이면 빈 문자열로 처리된다", () => {
      const result = gradeResponse(null, {
        itemType: "short_answer",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result.result).toBe("incorrect");
    });

    it("studentAnswer가 undefined이면 빈 문자열로 처리된다", () => {
      const result = gradeResponse(undefined as never, {
        itemType: "short_answer",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result.result).toBe("incorrect");
    });

    it("studentAnswer가 문자열이면 직접 사용된다", () => {
      const result = gradeResponse("42", {
        itemType: "short_answer",
        answer: { value: "42" },
        choices: null,
      }, 1);
      expect(result.result).toBe("correct");
    });

    it("알 수 없는 itemType이면 incorrect", () => {
      const result = gradeResponse(ans("answer"), {
        itemType: "unknown_type",
        answer: { value: "answer" },
        choices: null,
      }, 1);
      expect(result).toEqual({ result: "incorrect", score: 0, maxScore: 1 });
    });

    it("maxScore가 올바르게 반영된다", () => {
      const result = gradeResponse(ans("correct"), {
        itemType: "short_answer",
        answer: { value: "correct" },
        choices: null,
      }, 10);
      expect(result).toEqual({ result: "correct", score: 10, maxScore: 10 });
    });

    it("exact_value 유형도 short_answer와 동일하게 채점된다", () => {
      const result = gradeResponse(ans("42"), {
        itemType: "exact_value",
        answer: { value: "42" },
        choices: null,
      }, 1);
      expect(result.result).toBe("correct");
    });
  });
});
