"use client";

import {
  parseGenerationInfo,
  type GenerationInfoProps,
} from "./generation-info-utils";

export { parseGenerationInfo, type GenerationInfoData } from "./generation-info-utils";

// ─── 컴포넌트 ───

export function GenerationInfo({
  metadata,
  variant,
  isGenerated,
}: GenerationInfoProps) {
  const data = parseGenerationInfo({ metadata, variant, isGenerated });
  if (!data) return null;

  if (data.empty) {
    return (
      <span className="text-sm text-gray-400">{data.emptyLabel}</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {/* CAS 검증 배지 */}
      {data.casVerification.passed ? (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          {data.casVerification.label}
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          {data.casVerification.label}
        </span>
      )}

      {/* 실패 사유 */}
      {data.casVerification.failureReason && (
        <span className="text-xs text-red-600">
          실패 사유: {data.casVerification.failureReason}
        </span>
      )}

      {/* 생성 전략 배지 */}
      {data.strategy && (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          생성 전략: {data.strategy}
        </span>
      )}

      {/* 생성 일시 */}
      {data.generatedAt && (
        <span className="text-xs text-gray-500">
          {new Date(data.generatedAt).toLocaleString("ko-KR")}
        </span>
      )}
    </div>
  );
}
