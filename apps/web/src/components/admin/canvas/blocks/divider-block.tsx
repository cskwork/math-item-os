"use client";

import { memo } from "react";

export const DividerBlock = memo(function DividerBlock() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-300" />
      <span className="text-xs text-slate-400">구분선</span>
      <div className="h-px flex-1 bg-slate-300" />
    </div>
  );
});
