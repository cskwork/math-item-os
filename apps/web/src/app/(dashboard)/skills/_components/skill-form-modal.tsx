"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BLOOM_LEVEL_OPTIONS } from "@math-item-os/shared/constants/index";

// --- 폼 상태 타입 ---

export interface SkillFormData {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly topicPath: string;
  readonly bloomLevel: string;
  readonly estimatedTimeMin: string;
}

export const INITIAL_FORM: SkillFormData = {
  code: "",
  title: "",
  description: "",
  topicPath: "",
  bloomLevel: "",
  estimatedTimeMin: "",
};

// --- 스킬 생성/수정 모달 ---

export function SkillFormModal({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting,
  errorMessage,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData: SkillFormData;
  onSubmit: (data: SkillFormData) => void;
  isSubmitting: boolean;
  errorMessage: string;
}>) {
  const [form, setForm] = useState<SkillFormData>(initialData);

  const handleChange = useCallback(
    (field: keyof SkillFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(form);
    },
    [form, onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "새 스킬 추가" : "스킬 수정"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "새로운 스킬 정보를 입력하세요"
              : "스킬 정보를 수정하세요"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">코드</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => handleChange("code", e.target.value)}
              disabled={mode === "edit"}
              required={mode === "create"}
              placeholder="예: SKILL-001"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">스킬명</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              required
              placeholder="스킬 이름을 입력하세요"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="스킬에 대한 설명 (선택)"
              rows={3}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">분류 경로</label>
            <input
              type="text"
              value={form.topicPath}
              onChange={(e) => handleChange("topicPath", e.target.value)}
              required={mode === "create"}
              placeholder="예: math.algebra.linear"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Bloom 수준</label>
              <select
                value={form.bloomLevel}
                onChange={(e) => handleChange("bloomLevel", e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              >
                <option value="">선택 안 함</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {BLOOM_LEVEL_OPTIONS.map((opt: any) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.value}. {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">예상 소요시간 (분)</label>
              <input
                type="number"
                value={form.estimatedTimeMin}
                onChange={(e) => handleChange("estimatedTimeMin", e.target.value)}
                min={1}
                placeholder="분 단위"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2">
              <p className="text-xs text-red-700">{errorMessage}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "처리 중..." : mode === "create" ? "추가" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
