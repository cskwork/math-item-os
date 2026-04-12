"use client";

// 심층 풀이 패널 컴포넌트
// 멀티에이전트 풀이 결과(단계별 풀이 + 최종 답 + 검증)를 표시한다.
import { trpc } from "@/lib/trpc";

interface Step {
  readonly stepNumber: number;
  readonly latex: string;
  readonly explanation: string;
  readonly toolUsed?: string;
}

interface DeepSolvePanelProps {
  readonly latex: string;
  readonly schoolLevel: "elementary" | "middle" | "high";
  readonly onSolved?: (answer: string) => void;
}

export function DeepSolvePanel({ latex, schoolLevel, onSolved }: DeepSolvePanelProps) {
  const mutation = trpc.deepSolve.solve.useMutation();

  const handleSolve = () => {
    mutation.mutate({ latex, schoolLevel }, {
      onSuccess: (data) => {
        if (data?.finalAnswer) {
          onSolved?.(data.finalAnswer as string);
        }
      },
    });
  };

  const data = mutation.data as {
    steps?: Step[];
    finalAnswer?: string;
    verification?: string;
  } | null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSolve}
          disabled={mutation.isPending}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          심층 풀이
        </button>

        {mutation.isPending && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        )}
      </div>

      {mutation.error && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}

      {mutation.isSuccess && data && (
        <div className="mt-4 flex flex-col gap-4">
          {/* 풀이 단계 */}
          {data.steps && data.steps.length > 0 && (
            <ol className="flex flex-col gap-3">
              {data.steps.map((step) => (
                <li
                  key={step.stepNumber}
                  className="rounded border border-slate-100 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                      {step.stepNumber}
                    </span>
                    <span className="text-sm text-slate-800">{step.latex}</span>
                    {step.toolUsed && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {step.toolUsed}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 pl-8 text-sm text-slate-600">
                    {step.explanation}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {/* 최종 답 */}
          {data.finalAnswer && (
            <div className="rounded bg-green-50 p-3">
              <span className="text-sm font-semibold text-green-800">
                {data.finalAnswer}
              </span>
            </div>
          )}

          {/* 검증 */}
          {data.verification && (
            <p className="text-sm text-slate-500">{data.verification}</p>
          )}
        </div>
      )}
    </div>
  );
}
