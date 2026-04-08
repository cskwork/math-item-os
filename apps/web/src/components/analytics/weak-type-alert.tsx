"use client";

// 취약 유형 경고 배너 - 정답률이 threshold 미만인 typeLevel 표시

import type { TypeLevelStat } from "@math-item-os/shared/types/index";

// -------------------------------------------------
// 타입
// -------------------------------------------------

interface WeakTypeAlertProps {
  readonly weakTypes: ReadonlyArray<TypeLevelStat>;
}

// -------------------------------------------------
// 컴포넌트
// -------------------------------------------------

export function WeakTypeAlert({ weakTypes }: WeakTypeAlertProps) {
  if (weakTypes.length === 0) {
    return null;
  }

  const names = weakTypes.map((t) => t.label).join(", ");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-sm font-bold text-amber-600">
          !
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            취약 유형 알림
          </p>
          <p className="mt-1 text-sm text-amber-700">
            <span className="font-medium">{names}</span> 유형에서 정답률이 60%
            미만입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
