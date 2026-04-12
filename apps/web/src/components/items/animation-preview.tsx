"use client";

// 애니메이션 미리보기 컴포넌트
// Manim 코드를 생성하고 코드 블록 + 요약을 표시한다.
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type AnimationStyle = "step_by_step" | "transform" | "graph";

interface AnimationPreviewProps {
  readonly latex: string;
  readonly onGenerate?: () => void;
}

export function AnimationPreview({ latex, onGenerate }: AnimationPreviewProps) {
  const [style, setStyle] = useState<AnimationStyle>("step_by_step");
  const mutation = trpc.animate.generate.useMutation();

  const handleGenerate = () => {
    mutation.mutate({ latex, style });
    onGenerate?.();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as AnimationStyle)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="step_by_step">step_by_step</option>
          <option value="transform">transform</option>
          <option value="graph">graph</option>
        </select>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={mutation.isPending}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          애니메이션 생성
        </button>

        {mutation.isPending && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        )}
      </div>

      {mutation.error && (
        <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
      )}

      {mutation.isSuccess && mutation.data && (
        <div className="mt-4 flex flex-col gap-3">
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
            {mutation.data.manimCode}
          </pre>

          {mutation.data.summary && (
            <p className="text-sm text-slate-600">{mutation.data.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
