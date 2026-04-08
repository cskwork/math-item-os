"use client";

import { use, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { KatexRenderer } from "@/components/math/katex-renderer";

// --- 타입 ---

type SolveStep = "name" | "solve" | "results";

/** 문항별 답변 저장 (assignmentItemId -> 답변 값) */
type AnswerMap = Record<string, unknown>;

// --- 상수 ---

/** 결과 배지 스타일 */
const RESULT_BADGE_STYLES: Readonly<Record<string, string>> = {
  correct: "bg-green-100 text-green-800",
  incorrect: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-gray-100 text-gray-500",
};

/** 결과 한국어 라벨 */
const RESULT_LABELS: Readonly<Record<string, string>> = {
  correct: "정답",
  incorrect: "오답",
  partial: "부분 정답",
  pending: "미채점",
  skipped: "건너뜀",
};

// --- 메인 페이지 (Suspense 래퍼) ---

export default function SolvePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
        </div>
      }
    >
      <SolvePageInner assignmentId={id} />
    </Suspense>
  );
}

// --- 내부 컴포넌트 (useSearchParams 사용) ---

function SolvePageInner({
  assignmentId,
}: {
  readonly assignmentId: string;
}) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // 단계 관리
  const [step, setStep] = useState<SolveStep>("name");
  const [sessionToken, setSessionToken] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [studentName, setStudentName] = useState("");

  // --- tRPC 쿼리 ---

  const {
    data: assignmentData,
    isLoading: isLoadingAssignment,
    error: assignmentError,
  } = trpc.solve.getAssignment.useQuery(
    { assignmentId, solveToken: token },
    { enabled: token.length > 0 },
  );

  const startSessionMutation = trpc.solve.startSession.useMutation({
    onSuccess: (result) => {
      setSessionToken(result.session.token);
      setStep("solve");
      toast.success("풀이를 시작합니다");
    },
    onError: () => {
      toast.error("세션 시작에 실패했습니다");
    },
  });

  const submitResponseMutation = trpc.solve.submitResponse.useMutation({
    onSuccess: () => {
      toast.success("응답이 저장되었습니다");
    },
    onError: () => {
      toast.error("응답 저장에 실패했습니다");
    },
  });

  const submitSessionMutation = trpc.solve.submitSession.useMutation({
    onSuccess: () => {
      setStep("results");
      toast.success("제출이 완료되었습니다");
    },
    onError: () => {
      toast.error("제출에 실패했습니다");
    },
  });

  const {
    data: resultsData,
    isLoading: isLoadingResults,
  } = trpc.solve.getResults.useQuery(
    { sessionToken },
    { enabled: step === "results" && sessionToken.length > 0 },
  );

  // --- 핸들러 ---

  const handleStartSession = useCallback(() => {
    if (studentName.trim().length === 0) {
      toast.error("이름을 입력해주세요");
      return;
    }
    startSessionMutation.mutate({
      assignmentId,
      solveToken: token,
      studentName: studentName.trim(),
    });
  }, [assignmentId, token, studentName, startSessionMutation]);

  const handleAnswerChange = useCallback(
    (assignmentItemId: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [assignmentItemId]: value }));
    },
    [],
  );

  const handleSaveResponse = useCallback(
    (assignmentItemId: string) => {
      const answer = answers[assignmentItemId];
      if (answer == null) {
        toast.error("답변을 입력해주세요");
        return;
      }
      submitResponseMutation.mutate({
        sessionToken,
        assignmentItemId,
        studentAnswer:
          typeof answer === "object" && answer !== null
            ? (answer as Record<string, unknown>)
            : { value: String(answer) },
      });
    },
    [answers, sessionToken, submitResponseMutation],
  );

  const handleSubmitAll = useCallback(() => {
    const confirmed = window.confirm(
      "전체 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.",
    );
    if (!confirmed) return;
    submitSessionMutation.mutate({ sessionToken });
  }, [sessionToken, submitSessionMutation]);

  // --- 토큰 미제공 ---

  if (token.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-500">
          유효한 풀이 링크가 아닙니다. 선생님께 링크를 다시 요청해주세요.
        </p>
      </div>
    );
  }

  // --- 로딩 ---

  if (isLoadingAssignment) {
    return <SolveSkeleton />;
  }

  // --- 에러 ---

  if (assignmentError || !assignmentData) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">
          {assignmentError?.message ?? "과제를 불러올 수 없습니다."}
        </p>
      </div>
    );
  }

  const { assignment } = assignmentData;

  // --- Step 1: 이름 입력 ---

  if (step === "name") {
    return (
      <NameEntryStep
        title={assignment.title}
        studentName={studentName}
        onNameChange={setStudentName}
        onStart={handleStartSession}
        isPending={startSessionMutation.isPending}
      />
    );
  }

  // --- Step 2: 문제 풀기 ---

  if (step === "solve") {
    return (
      <SolveStep
        title={assignment.title}
        items={assignment.items}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onSaveResponse={handleSaveResponse}
        onSubmitAll={handleSubmitAll}
        isSaving={submitResponseMutation.isPending}
        isSubmitting={submitSessionMutation.isPending}
      />
    );
  }

  // --- Step 3: 결과 ---

  if (step === "results") {
    if (isLoadingResults) {
      return <SolveSkeleton />;
    }
    if (!resultsData) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center">
          <p className="text-sm text-slate-500">결과를 불러오는 중...</p>
        </div>
      );
    }
    return <ResultsStep session={resultsData.session} />;
  }

  return null;
}

// === Step 1: 이름 입력 ===

interface NameEntryStepProps {
  readonly title: string;
  readonly studentName: string;
  readonly onNameChange: (name: string) => void;
  readonly onStart: () => void;
  readonly isPending: boolean;
}

function NameEntryStep({
  title,
  studentName,
  onNameChange,
  onStart,
  isPending,
}: NameEntryStepProps) {
  return (
    <div className="flex flex-col items-center gap-8 pt-12">
      {/* 헤더 */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
          학습지 풀기
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      </div>

      {/* 이름 입력 카드 */}
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <label
          htmlFor="student-name"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          이름
        </label>
        <input
          id="student-name"
          type="text"
          value={studentName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onStart();
          }}
          placeholder="이름을 입력해주세요"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          maxLength={50}
          autoFocus
        />
        <Button
          className="w-full"
          disabled={isPending || studentName.trim().length === 0}
          onClick={onStart}
        >
          {isPending ? "시작하는 중..." : "시작하기"}
        </Button>
      </div>
    </div>
  );
}

// === Step 2: 문제 풀기 ===

interface SolveStepProps {
  readonly title: string;
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly position: number;
    readonly item: {
      readonly id: string;
      readonly bodyLatex: string;
      readonly bodyHtml?: string | null;
      readonly choices: unknown;
      readonly itemType: string;
      readonly formulaType?: string | null;
      readonly answerFormat?: string | null;
    };
  }>;
  readonly answers: AnswerMap;
  readonly onAnswerChange: (assignmentItemId: string, value: unknown) => void;
  readonly onSaveResponse: (assignmentItemId: string) => void;
  readonly onSubmitAll: () => void;
  readonly isSaving: boolean;
  readonly isSubmitting: boolean;
}

function SolveStep({
  title,
  items,
  answers,
  onAnswerChange,
  onSaveResponse,
  onSubmitAll,
  isSaving,
  isSubmitting,
}: SolveStepProps) {
  const answeredCount = Object.keys(answers).filter(
    (key) => answers[key] != null && String(answers[key]).length > 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <span className="text-sm text-slate-500">
          {answeredCount} / {items.length} 응답
        </span>
      </div>

      {/* 문항 목록 */}
      {items.map((ai) => (
        <ProblemCard
          key={ai.id}
          assignmentItemId={ai.id}
          position={ai.position}
          item={ai.item}
          answer={answers[ai.id]}
          onAnswerChange={onAnswerChange}
          onSave={onSaveResponse}
          isSaving={isSaving}
        />
      ))}

      {/* 전체 제출 */}
      <div className="sticky bottom-0 border-t bg-white px-4 py-4">
        <Button
          className="w-full"
          disabled={isSubmitting}
          onClick={onSubmitAll}
        >
          {isSubmitting ? "제출 중..." : "전체 제출"}
        </Button>
      </div>
    </div>
  );
}

// --- 개별 문항 카드 ---

interface ProblemCardProps {
  readonly assignmentItemId: string;
  readonly position: number;
  readonly item: {
    readonly id: string;
    readonly bodyLatex: string;
    readonly bodyHtml?: string | null;
    readonly choices: unknown;
    readonly itemType: string;
    readonly formulaType?: string | null;
    readonly answerFormat?: string | null;
  };
  readonly answer: unknown;
  readonly onAnswerChange: (assignmentItemId: string, value: unknown) => void;
  readonly onSave: (assignmentItemId: string) => void;
  readonly isSaving: boolean;
}

function ProblemCard({
  assignmentItemId,
  position,
  item,
  answer,
  onAnswerChange,
  onSave,
  isSaving,
}: ProblemCardProps) {
  const hasAnswer = answer != null && String(answer).length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 shadow-sm",
        hasAnswer ? "border-blue-200" : "border-slate-200",
      )}
    >
      {/* 문항 번호 */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
            hasAnswer
              ? "bg-blue-500 text-white"
              : "bg-slate-200 text-slate-600",
          )}
        >
          {position + 1}
        </span>
        <span className="text-xs text-slate-400">{item.itemType}</span>
      </div>

      {/* 문제 본문 */}
      <div className="mb-4">
        <KatexRenderer latex={item.bodyLatex} displayMode />
      </div>

      {/* 답변 입력 */}
      <AnswerInput
        itemType={item.itemType}
        choices={item.choices}
        answer={answer}
        onChange={(value) => onAnswerChange(assignmentItemId, value)}
      />

      {/* 저장 버튼 */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving || !hasAnswer}
          onClick={() => onSave(assignmentItemId)}
        >
          {isSaving ? "저장 중..." : "응답 저장"}
        </Button>
      </div>
    </div>
  );
}

// --- 답변 입력 컴포넌트 ---

interface AnswerInputProps {
  readonly itemType: string;
  readonly choices: unknown;
  readonly answer: unknown;
  readonly onChange: (value: unknown) => void;
}

function AnswerInput({ itemType, choices, answer, onChange }: AnswerInputProps) {
  // 객관식: 라디오 버튼
  if (itemType === "multiple_choice" && Array.isArray(choices)) {
    return (
      <div className="flex flex-col gap-2">
        {(choices as ReadonlyArray<{ label: string; latex: string }>).map(
          (choice) => (
            <label
              key={choice.label}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                answer === choice.label
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="choice"
                value={choice.label}
                checked={answer === choice.label}
                onChange={() => onChange(choice.label)}
                className="accent-blue-500"
              />
              <KatexRenderer latex={choice.latex} displayMode={false} />
            </label>
          ),
        )}
      </div>
    );
  }

  // 참/거짓
  if (itemType === "true_false") {
    return (
      <div className="flex gap-3">
        {(["true", "false"] as const).map((val) => (
          <label
            key={val}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
              answer === val
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200 hover:bg-slate-50",
            )}
          >
            <input
              type="radio"
              name="tf"
              value={val}
              checked={answer === val}
              onChange={() => onChange(val)}
              className="sr-only"
            />
            {val === "true" ? "참 (O)" : "거짓 (X)"}
          </label>
        ))}
      </div>
    );
  }

  // 서술형
  if (itemType === "essay") {
    return (
      <textarea
        value={typeof answer === "string" ? answer : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="답을 작성해주세요"
        rows={4}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    );
  }

  // 단답형 / 빈칸 / 수식 입력 (기본)
  return (
    <input
      type="text"
      value={typeof answer === "string" ? answer : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="답을 입력해주세요"
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

// === Step 3: 결과 ===

interface ResultsStepProps {
  readonly session: {
    readonly totalScore: unknown;
    readonly maxScore: unknown;
    readonly assignment: {
      readonly title: string;
      readonly items: ReadonlyArray<{
        readonly id: string;
        readonly position: number;
        readonly item: {
          readonly id: string;
          readonly bodyLatex: string;
          readonly bodyHtml?: string | null;
          readonly choices: unknown;
          readonly answer: unknown;
          readonly itemType: string;
        };
      }>;
    };
    readonly responses: ReadonlyArray<{
      readonly assignmentItemId: string;
      readonly studentAnswer: unknown;
      readonly result: string;
      readonly score: unknown;
    }>;
  };
}

function ResultsStep({ session }: ResultsStepProps) {
  const totalScore = Number(session.totalScore ?? 0);
  const maxScore = Number(session.maxScore ?? 0);
  const items = session.assignment.items;
  const responses = session.responses;

  // 응답을 assignmentItemId로 빠르게 조회할 수 있도록 맵 구성
  const responseMap = new Map(
    responses.map((r) => [r.assignmentItemId, r]),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 점수 헤더 */}
      <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
        <p className="mb-1 text-sm text-slate-500">결과</p>
        <p className="text-3xl font-bold text-slate-900">
          {totalScore} / {maxScore}
        </p>
        <p className="mt-2 text-sm text-slate-500">풀이가 완료되었습니다</p>
      </div>

      {/* 문항별 결과 */}
      {items.map((ai) => {
        const response = responseMap.get(ai.id);
        const result = response?.result ?? "skipped";
        const badgeStyle =
          RESULT_BADGE_STYLES[result] ?? RESULT_BADGE_STYLES.pending;
        const label = RESULT_LABELS[result] ?? result;

        return (
          <div
            key={ai.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            {/* 번호 + 결과 배지 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {ai.position + 1}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  badgeStyle,
                )}
              >
                {label}
              </span>
            </div>

            {/* 문제 본문 */}
            <div className="mb-3">
              <KatexRenderer latex={ai.item.bodyLatex} displayMode />
            </div>

            {/* 학생 답변 */}
            {response && (
              <div className="mb-2 text-sm">
                <span className="font-medium text-slate-500">내 답변: </span>
                <span className="text-slate-700">
                  {formatAnswer(response.studentAnswer)}
                </span>
              </div>
            )}

            {/* 오답 시 정답 표시 */}
            {result === "incorrect" && ai.item.answer != null && (
              <div className="text-sm">
                <span className="font-medium text-green-600">정답: </span>
                <span className="text-slate-700">
                  {formatAnswer(ai.item.answer)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* 완료 메시지 */}
      <div className="py-6 text-center">
        <p className="text-sm text-slate-500">수고하셨습니다!</p>
      </div>
    </div>
  );
}

// --- 유틸리티 ---

/** 답변 값을 사람이 읽을 수 있는 문자열로 변환 */
function formatAnswer(answer: unknown): string {
  if (answer == null) return "-";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number") return String(answer);
  if (typeof answer === "object") {
    const obj = answer as Record<string, unknown>;
    if ("value" in obj && obj.value != null) return String(obj.value);
    return JSON.stringify(answer);
  }
  return String(answer);
}

// --- 스켈레톤 ---

function SolveSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-8">
      <div className="mx-auto h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
      <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
    </div>
  );
}
