"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getHelpEntry } from "./help-config";

// --- 타입 ---

interface PageHelpProps {
  readonly pageId: string;
}

// --- 컴포넌트 ---

export function PageHelp({ pageId }: PageHelpProps) {
  const entry = getHelpEntry(pageId);

  if (!entry) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label={`${entry.title} 도움말`}
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          {/* 제목 */}
          <h3 className="font-semibold text-sm text-slate-900">
            {entry.title}
          </h3>

          {/* 설명 */}
          <p className="text-sm text-slate-600 leading-relaxed">
            {entry.shortDescription}
          </p>

          {/* 팁 */}
          <ul className="space-y-1.5">
            {entry.tips.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-2 text-xs text-slate-500"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {tip}
              </li>
            ))}
          </ul>

          {/* 자세히 보기 링크 */}
          <Link
            href={`/help#${entry.id}`}
            className="inline-block text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            자세히 보기 →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
