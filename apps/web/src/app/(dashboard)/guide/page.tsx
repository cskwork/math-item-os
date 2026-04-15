"use client";

import { ServiceFlowGuide } from "@/components/guide/service-flow-guide";

export default function GuidePage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          서비스 흐름 가이드
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          서비스의 주요 기능과 추천 사용 순서를 시각적으로 안내합니다.
          노드를 클릭하면 해당 페이지로 이동합니다.
        </p>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-slate-200">
        <ServiceFlowGuide />
      </div>
    </div>
  );
}
