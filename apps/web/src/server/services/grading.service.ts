// 자동 채점 서비스 - 문항 유형별 채점, 세션 점수 집계
import { prisma } from "@math-item-os/db";
import type { Prisma } from "@math-item-os/db";

/** 인터랙티브 트랜잭션 클라이언트 타입 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// -------------------------------------------------
// 타입 정의
// -------------------------------------------------

/** 채점 결과 */
interface GradeResult {
  readonly result: "correct" | "incorrect" | "partial";
  readonly score: number;
  readonly maxScore: number;
}

/** 채점에 필요한 문항 정보 */
interface GradableItem {
  readonly itemType: string;
  readonly answer: Prisma.JsonValue;
  readonly choices: Prisma.JsonValue;
}

/** 선택지 구조 */
interface ChoiceData {
  readonly label: string;
  readonly isCorrect: boolean;
}

/** 정답 구조 */
interface AnswerData {
  readonly value: string;
  readonly format?: string;
  readonly alternatives?: readonly string[];
}

// -------------------------------------------------
// 1. 세션 전체 채점
// -------------------------------------------------

/** 세션의 모든 응답을 채점하고 총점을 집계한다. */
export async function gradeSession(sessionId: string) {
  return prisma.$transaction(async (tx: TxClient) => {
    // 세션의 모든 응답 + 관련 문항 데이터 조회
    const responses = await tx.studentResponse.findMany({
      where: { sessionId },
      include: {
        assignmentItem: {
          include: {
            item: {
              select: {
                itemType: true,
                answer: true,
                choices: true,
              },
            },
          },
        },
      },
    });

    let totalScore = 0;
    let maxScore = 0;

    // 각 응답 채점
    for (const response of responses) {
      const item = response.assignmentItem.item;
      const points = response.assignmentItem.points;
      const itemMaxScore = points != null ? Number(points) : 1;

      const gradeResult = gradeResponse(
        response.studentAnswer,
        {
          itemType: item.itemType,
          answer: item.answer,
          choices: item.choices,
        },
        itemMaxScore,
      );

      // 응답 레코드 갱신
      await tx.studentResponse.update({
        where: { id: response.id },
        data: {
          result: gradeResult.result,
          score: gradeResult.score,
          maxScore: gradeResult.maxScore,
        },
      });

      totalScore += gradeResult.score;
      maxScore += gradeResult.maxScore;
    }

    // 세션 상태 + 점수 갱신
    const gradedSession = await tx.studentSession.update({
      where: { id: sessionId },
      data: {
        status: "graded",
        gradedAt: new Date(),
        totalScore,
        maxScore,
      },
      include: {
        responses: true,
      },
    });

    return gradedSession;
  });
}

// -------------------------------------------------
// 2. 개별 응답 채점
// -------------------------------------------------

/**
 * 학생 응답을 문항 유형별로 채점한다.
 * itemType에 따라 적절한 비교 로직을 적용한다.
 */
export function gradeResponse(
  studentAnswer: Prisma.JsonValue,
  item: GradableItem,
  itemMaxScore: number,
): GradeResult {
  const maxScore = itemMaxScore;

  // studentAnswer에서 value 추출 (JSON 객체의 "value" 필드)
  const answerValue = extractAnswerValue(studentAnswer);

  switch (item.itemType) {
    case "multiple_choice":
      return gradeMultipleChoice(answerValue, item.choices, maxScore);

    case "short_answer":
    case "exact_value":
      return gradeExactMatch(answerValue, item.answer, maxScore);

    case "true_false":
      return gradeTrueFalse(answerValue, item.answer, maxScore);

    case "fill_in_blank":
      return gradeExactMatch(answerValue, item.answer, maxScore);

    case "expression":
      // MVP: 문자열 비교 (향후 SymPy 연동 예정)
      return gradeExactMatch(answerValue, item.answer, maxScore);

    case "essay":
      // 서술형: 자동 채점 불가, partial로 표시 (수동 채점 필요)
      return { result: "partial", score: 0, maxScore };

    default:
      return { result: "incorrect", score: 0, maxScore };
  }
}

// -------------------------------------------------
// 3. 유형별 채점 로직
// -------------------------------------------------

/** 선택형 채점: 학생이 선택한 label과 isCorrect가 true인 선택지 비교 */
function gradeMultipleChoice(
  studentValue: string,
  choices: Prisma.JsonValue,
  maxScore: number,
): GradeResult {
  if (!Array.isArray(choices)) {
    return { result: "incorrect", score: 0, maxScore };
  }

  const correctChoice = (choices as ChoiceData[]).find(
    (c) => c.isCorrect === true,
  );

  if (!correctChoice) {
    return { result: "incorrect", score: 0, maxScore };
  }

  const normalized = normalizeAnswer(studentValue);
  const correctLabel = normalizeAnswer(correctChoice.label);

  if (normalized === correctLabel) {
    return { result: "correct", score: maxScore, maxScore };
  }

  return { result: "incorrect", score: 0, maxScore };
}

/** 정확 일치 채점: 정규화 후 비교, alternatives도 확인 */
function gradeExactMatch(
  studentValue: string,
  answer: Prisma.JsonValue,
  maxScore: number,
): GradeResult {
  const answerData = answer as AnswerData | null;

  if (!answerData?.value) {
    return { result: "incorrect", score: 0, maxScore };
  }

  const normalized = normalizeAnswer(studentValue);
  const correctNormalized = normalizeAnswer(answerData.value);

  // 정답 일치 확인
  if (normalized === correctNormalized) {
    return { result: "correct", score: maxScore, maxScore };
  }

  // alternatives 확인
  if (answerData.alternatives && Array.isArray(answerData.alternatives)) {
    const matchesAlternative = answerData.alternatives.some(
      (alt) => normalizeAnswer(alt) === normalized,
    );

    if (matchesAlternative) {
      return { result: "correct", score: maxScore, maxScore };
    }
  }

  return { result: "incorrect", score: 0, maxScore };
}

/** 참/거짓 채점: 불리언 비교 */
function gradeTrueFalse(
  studentValue: string,
  answer: Prisma.JsonValue,
  maxScore: number,
): GradeResult {
  const answerData = answer as AnswerData | null;

  if (!answerData?.value) {
    return { result: "incorrect", score: 0, maxScore };
  }

  const studentBool = parseBooleanValue(studentValue);
  const correctBool = parseBooleanValue(answerData.value);

  if (studentBool === correctBool) {
    return { result: "correct", score: maxScore, maxScore };
  }

  return { result: "incorrect", score: 0, maxScore };
}

// -------------------------------------------------
// 헬퍼 함수
// -------------------------------------------------

/** 답안 값을 정규화한다 (공백 제거, 소문자 변환, 중복 공백 제거). */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** JSON 응답 객체에서 value 필드를 문자열로 추출한다. */
function extractAnswerValue(studentAnswer: Prisma.JsonValue): string {
  if (studentAnswer == null) {
    return "";
  }

  if (typeof studentAnswer === "string") {
    return studentAnswer;
  }

  if (typeof studentAnswer === "object" && !Array.isArray(studentAnswer)) {
    const obj = studentAnswer as Record<string, unknown>;
    if (typeof obj.value === "string") {
      return obj.value;
    }
    if (obj.value != null) {
      return String(obj.value);
    }
  }

  return String(studentAnswer);
}

/** 문자열을 불리언 값으로 파싱한다. */
function parseBooleanValue(value: string): boolean | null {
  const normalized = normalizeAnswer(value);
  if (
    normalized === "true" ||
    normalized === "참" ||
    normalized === "o" ||
    normalized === "1"
  ) {
    return true;
  }
  if (
    normalized === "false" ||
    normalized === "거짓" ||
    normalized === "x" ||
    normalized === "0"
  ) {
    return false;
  }
  return null;
}
