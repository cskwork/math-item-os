"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const pathLabels: Record<string, string> = {
  items: "문항 관리",
  new: "새 문항",
  upload: "대량 업로드",
  search: "검색",
  skills: "스킬 관리",
  graph: "그래프",
  misconceptions: "오개념",
  admin: "관리",
  dashboard: "대시보드",
  reviews: "검수 큐",
  generate: "문항 생성",
  assignments: "학습지",
  users: "사용자",
  audit: "감사 로그",
  help: "도움말",
};

function isDynamicSegment(segment: string): boolean {
  return segment.includes("-") && segment.length > 8;
}

function resolveLabel(segment: string): string {
  if (isDynamicSegment(segment)) {
    return "상세";
  }
  return pathLabels[segment] ?? segment;
}

interface BreadcrumbSegment {
  readonly label: string;
  readonly href: string;
}

function buildSegments(pathname: string): readonly BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part, index) => ({
    label: resolveLabel(part),
    href: "/" + parts.slice(0, index + 1).join("/"),
  }));
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = buildSegments(pathname);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <li key={segment.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
              {isLast ? (
                <span className="font-medium text-slate-900">
                  {segment.label}
                </span>
              ) : (
                <Link
                  href={segment.href as any}
                  className="text-slate-500 hover:text-slate-700"
                >
                  {segment.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
