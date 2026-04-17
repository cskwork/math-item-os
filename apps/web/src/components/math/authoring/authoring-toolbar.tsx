"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AuthoringBlockType } from "./types";

interface AuthoringToolbarProps {
  readonly editorMode: "visual" | "latex";
  readonly onAddBlock: (type: AuthoringBlockType) => void;
  readonly onToggleMode: () => void;
  readonly subject?: "MATH" | "IT_CERT" | "ENGLISH";
}

const MATH_BLOCKS: ReadonlyArray<{
  type: AuthoringBlockType;
  label: string;
  icon: string;
  tooltip: string;
}> = [
  { type: "body", label: "본문", icon: "T", tooltip: "한국어 텍스트 + 수식을 혼합 입력하는 문제 본문을 추가합니다" },
  { type: "choices", label: "선택지", icon: "①", tooltip: "객관식 보기(①②③④⑤)를 추가합니다. 정답 표시 가능" },
  { type: "table", label: "표", icon: "⊞", tooltip: "행/열 조절 가능한 표를 추가합니다" },
  { type: "image", label: "이미지", icon: "🖼", tooltip: "그래프, 도형 등 이미지를 추가합니다" },
  { type: "solution", label: "풀이", icon: "✎", tooltip: "풀이 과정을 수식과 함께 작성합니다" },
];

const IT_CERT_BLOCKS: ReadonlyArray<{
  type: AuthoringBlockType;
  label: string;
  icon: string;
  tooltip: string;
}> = [
  { type: "body", label: "본문", icon: "T", tooltip: "문제 본문 텍스트를 입력합니다" },
  { type: "code", label: "코드", icon: "</>", tooltip: "C/Java/Python/SQL 코드 블록을 추가합니다" },
  { type: "output", label: "출력", icon: ">_", tooltip: "예상 실행 결과를 입력합니다" },
  { type: "choices", label: "선택지", icon: "①", tooltip: "객관식 보기를 추가합니다" },
  { type: "table", label: "표", icon: "⊞", tooltip: "표를 추가합니다" },
  { type: "image", label: "이미지", icon: "🖼", tooltip: "이미지를 추가합니다" },
  { type: "solution", label: "풀이", icon: "✎", tooltip: "풀이 과정을 작성합니다" },
];

const AuthoringToolbar = memo(function AuthoringToolbar({
  editorMode,
  onAddBlock,
  onToggleMode,
  subject = "MATH",
}: AuthoringToolbarProps) {
  const blockButtons = subject === "IT_CERT" ? IT_CERT_BLOCKS : MATH_BLOCKS;

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      {/* 블록 추가 버튼들 */}
      <div className="flex items-center gap-1">
        <span className="mr-2 text-xs font-medium text-slate-500 dark:text-slate-400">블록 추가:</span>
        {blockButtons.map(({ type, label, icon, tooltip }) => (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAddBlock(type)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* 수식 입력 모드 토글 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleMode}
            className="h-7 gap-1.5 px-3 text-xs"
          >
            {editorMode === "visual" ? (
              <>
                <span className="font-mono">Tx</span>
                <span>LaTeX 모드</span>
              </>
            ) : (
              <>
                <span>fx</span>
                <span>시각 모드</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{editorMode === "visual"
            ? "수식을 LaTeX 코드로 직접 편집합니다 (고급)"
            : "기호 팔레트와 수식 조립기를 사용합니다 (권장)"
          }</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
});

export { AuthoringToolbar };
