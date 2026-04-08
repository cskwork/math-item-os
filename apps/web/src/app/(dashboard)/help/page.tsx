"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  helpEntries,
  getHelpEntriesBySection,
  type PageHelpEntry,
} from "@/components/help/help-config";

// --- 상수 ---

const SECTION_LABELS: Readonly<Record<string, string>> = {
  main: "주요 기능",
  admin: "관리 기능",
};

// --- 목차 컴포넌트 ---

function TableOfContents({
  activeId,
  onSelect,
}: {
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}) {
  const mainEntries = getHelpEntriesBySection("main");
  const adminEntries = getHelpEntriesBySection("admin");

  return (
    <nav className="space-y-6">
      {[
        { label: SECTION_LABELS.main, entries: mainEntries },
        { label: SECTION_LABELS.admin, entries: adminEntries },
      ].map(({ label, entries }) => (
        <div key={label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </h3>
          <ul className="space-y-1">
            {entries.map((entry) => {
              const Icon = entry.icon;
              const isActive = activeId === entry.id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(entry.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {entry.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// --- 섹션 컴포넌트 ---

function HelpSection({ entry }: { readonly entry: PageHelpEntry }) {
  const Icon = entry.icon;

  return (
    <section
      id={entry.id}
      className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-6"
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {entry.title}
          </h2>
          <span className="text-xs text-slate-400">
            {SECTION_LABELS[entry.section]}
          </span>
        </div>
      </div>

      {/* 상세 설명 */}
      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        {entry.fullDescription}
      </p>

      {/* 팁 */}
      <div className="rounded-md bg-slate-50 p-4">
        <h4 className="mb-2 text-xs font-semibold text-slate-500">
          사용 팁
        </h4>
        <ul className="space-y-2">
          {entry.tips.map((tip) => (
            <li
              key={tip}
              className="flex items-start gap-2 text-sm text-slate-600"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- 페이지 ---

export default function HelpPage() {
  const [activeId, setActiveId] = useState(helpEntries[0]?.id ?? "");

  // URL 해시로 초기 스크롤 처리
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setActiveId(hash);
      const element = document.getElementById(hash);
      element?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleSelect = (id: string) => {
    setActiveId(id);
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    window.history.replaceState(null, "", `#${id}`);
  };

  // 스크롤 위치에 따라 activeId 자동 업데이트
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const helpEntry of helpEntries) {
      const element = document.getElementById(helpEntry.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">도움말</h1>
        <p className="mt-1 text-sm text-slate-500">
          각 기능의 사용법과 팁을 안내합니다
        </p>
      </div>

      {/* 레이아웃: 목차 + 콘텐츠 */}
      <div className="flex gap-8">
        {/* 좌측 목차 (데스크톱만) */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <TableOfContents activeId={activeId} onSelect={handleSelect} />
          </div>
        </aside>

        {/* 우측 콘텐츠 */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* 주요 기능 */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              {SECTION_LABELS.main}
            </h2>
            <div className="space-y-4">
              {getHelpEntriesBySection("main").map((entry) => (
                <HelpSection key={entry.id} entry={entry} />
              ))}
            </div>
          </div>

          {/* 관리 기능 */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              {SECTION_LABELS.admin}
            </h2>
            <div className="space-y-4">
              {getHelpEntriesBySection("admin").map((entry) => (
                <HelpSection key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
