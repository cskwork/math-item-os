"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { KatexRenderer } from "@/components/math/katex-renderer";
import { SimilarItemsPanel } from "@/components/search/similar-items-panel";
import { GenerationInfo } from "@/components/admin/generation-info";
import { Button } from "@/components/ui/button";
import {
  QUALITY_STATUS,
  ITEM_TYPE,
  SCHOOL_LEVEL,
  DIFFICULTY_LEVEL,
  ANSWER_FORMAT,
  type QualityStatusKey,
  type ItemTypeKey,
  type SchoolLevelKey,
  type DifficultyLevelKey,
  type AnswerFormatKey,
} from "@math-item-os/shared/constants/index";

// --- 상태 배지 색상 ---

const STATUS_COLOR_MAP: Record<QualityStatusKey, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  reviewed: "bg-blue-100 text-blue-700 border-blue-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  retired: "bg-red-100 text-red-700 border-red-300",
} as const;

// --- Props ---

interface ReviewDetailSheetProps {
  readonly itemId: string | null;
  readonly onClose: () => void;
  readonly onApprove: (id: string) => void;
  readonly onReject: (id: string) => void;
}

// --- Component ---

export function ReviewDetailSheet({
  itemId,
  onClose,
  onApprove,
  onReject,
}: ReviewDetailSheetProps) {
  const { data: item, isLoading, error } = trpc.item.getById.useQuery(
    { id: itemId! },
    { enabled: itemId !== null },
  );

  const isOpen = itemId !== null;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="sm:max-w-2xl w-full flex flex-col h-full p-0"
      >
        {isLoading && (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <SheetTitle>문항 상세</SheetTitle>
            </SheetHeader>
            <SheetSkeleton />
          </>
        )}

        {!isLoading && error && (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <SheetTitle>문항 상세</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-red-600">
                문항 데이터를 불러오지 못했습니다: {error.message}
              </p>
            </div>
          </>
        )}

        {!isLoading && !error && item && (
          <SheetBody
            item={item}
            itemId={itemId!}
            onApprove={onApprove}
            onReject={onReject}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- Skeleton ---

function SheetSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded bg-slate-200" />
      <div className="h-16 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

// --- Body ---

interface SheetBodyProps {
  /** trpc.item.getById 반환값 (Prisma ITEM_FULL_INCLUDE 포함) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly item: any;
  readonly itemId: string;
  readonly onApprove: (id: string) => void;
  readonly onReject: (id: string) => void;
}

function SheetBody({ item, itemId, onApprove, onReject }: SheetBodyProps) {
  const statusKey = item.status as QualityStatusKey;
  const statusLabel = QUALITY_STATUS[statusKey]?.label ?? item.status;
  const statusColor = STATUS_COLOR_MAP[statusKey] ?? STATUS_COLOR_MAP.draft;

  const schoolLabel =
    SCHOOL_LEVEL[item.schoolLevel as SchoolLevelKey]?.label ?? item.schoolLevel;
  const itemTypeLabel =
    ITEM_TYPE[item.itemType as ItemTypeKey]?.label ?? item.itemType;
  const difficultyLabel =
    item.difficultyAuthor != null
      ? (DIFFICULTY_LEVEL[item.difficultyAuthor as DifficultyLevelKey]?.label ??
          String(item.difficultyAuthor))
      : "-";
  const answerFormatLabel =
    ANSWER_FORMAT[item.answerFormat as AnswerFormatKey]?.label ??
    item.answerFormat;

  const answerValue =
    typeof item.answer === "object" && item.answer !== null
      ? ((item.answer as { value?: string }).value ?? JSON.stringify(item.answer))
      : String(item.answer);

  const isActionable = statusKey === "draft" || statusKey === "reviewed";

  return (
    <>
      {/* Header */}
      <SheetHeader className="p-6 pb-4 border-b">
        <SheetTitle>문항 상세</SheetTitle>
        <SheetDescription asChild>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                statusColor,
              )}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-slate-400">
              v{item.currentVersion}
            </span>
            {item.isGenerated && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                AI 생성
              </span>
            )}
          </div>
        </SheetDescription>
      </SheetHeader>

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-6">
        {/* 1. 수식 표시 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            수식 표시
          </h3>
          <div className="flex min-h-[60px] items-center justify-center rounded-md border border-slate-100 bg-slate-50 p-6">
            <KatexRenderer
              latex={item.bodyLatex}
              displayMode={true}
              className="text-lg text-slate-900"
            />
          </div>
        </section>

        {/* 2. 기본 정보 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            기본 정보
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="학교급/학년">
              {schoolLabel} {item.grade}학년
            </InfoRow>
            <InfoRow label="문항 유형">{itemTypeLabel}</InfoRow>
            <InfoRow label="난이도">{difficultyLabel}</InfoRow>
            <InfoRow label="정답 형식">{answerFormatLabel}</InfoRow>
            <InfoRow label="정답">
              {item.answerFormat === "expression" ? (
                <KatexRenderer
                  latex={answerValue}
                  displayMode={false}
                  className="text-sm"
                />
              ) : (
                answerValue
              )}
            </InfoRow>
          </dl>
        </section>

        {/* 3. 생성 정보 (conditional) */}
        {item.isGenerated && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              생성 정보
            </h3>
            <GenerationInfo
              metadata={item.metadata}
              variant={item.variants?.[0] ?? null}
              isGenerated={item.isGenerated}
            />
          </section>
        )}

        {/* 4. 유사 문항 */}
        <section>
          <SimilarItemsPanel itemId={itemId} />
        </section>
      </div>

      {/* Footer */}
      {isActionable && (
        <div className="border-t p-4 flex items-center gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={`/items/new?edit=${itemId}` as any}>
            <Button variant="secondary" size="sm">
              수정
            </Button>
          </Link>
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => onApprove(itemId)}
          >
            검수 완료
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => onReject(itemId)}
          >
            반려
          </Button>
        </div>
      )}
    </>
  );
}

// --- Info row helper ---

function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </>
  );
}
