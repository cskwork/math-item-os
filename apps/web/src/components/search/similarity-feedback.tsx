"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type FeedbackState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly selection: boolean }
  | { readonly status: "submitted"; readonly selection: boolean }
  | { readonly status: "error"; readonly message: string };

const INITIAL_STATE: FeedbackState = { status: "idle" } as const;

interface SimilarityFeedbackProps {
  readonly sourceItemId: string;
  readonly targetItemId: string;
}

export function SimilarityFeedback({
  sourceItemId,
  targetItemId,
}: SimilarityFeedbackProps) {
  const [state, setState] = useState<FeedbackState>(INITIAL_STATE);

  const mutation = trpc.search.similarFeedback.useMutation({
    onSuccess: (_data, variables) => {
      setState({ status: "submitted", selection: variables.relevant });
    },
    onError: (error) => {
      setState({ status: "error", message: error.message });
    },
  });

  const handleClick = useCallback(
    (relevant: boolean) => {
      setState({ status: "loading", selection: relevant });
      mutation.mutate({ sourceItemId, targetItemId, relevant });
    },
    [mutation, sourceItemId, targetItemId],
  );

  const handleRetry = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // 에러 상태
  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">오류 발생</span>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 제출 완료 상태
  if (state.status === "submitted") {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-medium",
            state.selection
              ? "border-green-200 bg-green-50 text-green-600"
              : "border-red-200 bg-red-50 text-red-600",
          )}
        >
          {state.selection ? "관련 있음" : "관련 없음"}
        </span>
        <span className="text-xs text-slate-400">
          피드백이 기록되었습니다
        </span>
      </div>
    );
  }

  const isLoading = state.status === "loading";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleClick(true)}
        className={cn(
          "rounded-md border px-2 py-0.5 text-xs transition-colors",
          isLoading && state.selection === true
            ? "border-green-200 bg-green-50 text-green-600"
            : "border-slate-200 text-slate-500 hover:border-green-300 hover:bg-green-50 hover:text-green-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        관련 있음
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleClick(false)}
        className={cn(
          "rounded-md border px-2 py-0.5 text-xs transition-colors",
          isLoading && state.selection === false
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        관련 없음
      </button>
    </div>
  );
}
