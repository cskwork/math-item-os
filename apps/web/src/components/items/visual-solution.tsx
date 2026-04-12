"use client";

// 시각화 생성 컴포넌트
// SVG 또는 Chart.js JSON 시각화를 생성하고 표시한다.
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface VisualSolutionProps {
  readonly latex: string;
  readonly onGenerate?: () => void;
}

export function VisualSolution({ latex, onGenerate }: VisualSolutionProps) {
  const [vizType, setVizType] = useState<"svg" | "chartjs">("svg");
  const mutation = trpc.visualize.generate.useMutation();

  const handleGenerate = () => {
    mutation.mutate({ latex });
    onGenerate?.();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <select
          value={vizType}
          onChange={(e) => setVizType(e.target.value as "svg" | "chartjs")}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="svg">SVG</option>
          <option value="chartjs">Chart.js</option>
        </select>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={mutation.isPending}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          시각화 생성
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
          {mutation.data.visualizationType === "svg" ? (
            <div
              className="overflow-auto rounded border border-slate-100 p-3"
              dangerouslySetInnerHTML={{ __html: mutation.data.content }}
            />
          ) : (
            <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
              {mutation.data.content}
            </pre>
          )}

          {mutation.data.reviewNotes && (
            <p className="text-sm text-slate-600">{mutation.data.reviewNotes}</p>
          )}
        </div>
      )}
    </div>
  );
}
