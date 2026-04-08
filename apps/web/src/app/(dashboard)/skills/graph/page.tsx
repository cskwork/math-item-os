"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHelp } from "@/components/help/page-help";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SkillGraph } from "@/components/skills/skill-graph";
import { SkillItemsPanel } from "@/components/skills/skill-items-panel";

// --- 타입 정의 ---

interface SkillOption {
  readonly id: string;
  readonly label: string;
}

// --- 방향 옵션 ---

const DIRECTION_OPTIONS = [
  { value: "ancestors", label: "선수" },
  { value: "descendants", label: "후속" },
  { value: "both", label: "전체" },
] as const;

type Direction = (typeof DIRECTION_OPTIONS)[number]["value"];

const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// --- 컨트롤바 스켈레톤 ---

function ControlBarSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="h-9 w-48 animate-pulse rounded-md bg-slate-200" />
      <div className="h-9 w-24 animate-pulse rounded-md bg-slate-200" />
      <div className="h-9 w-48 animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}

// --- 빈 선택 안내 ---

function EmptySelection() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-500">
          탐색할 스킬을 선택해주세요
        </p>
        <p className="text-xs text-slate-400">
          상단 드롭다운에서 루트 스킬을 선택하면 선수/후속 관계 그래프가 표시됩니다.
        </p>
      </div>
    </div>
  );
}

// --- 메인 페이지 ---

export default function SkillGraphPage() {
  const router = useRouter();

  // -- 상태 관리 --
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [panelSkillId, setPanelSkillId] = useState<string | null>(null);
  const [depth, setDepth] = useState(5);
  const [direction, setDirection] = useState<Direction>("both");

  // -- 스킬 목록 조회 --
  const { data: skillListData, isLoading: isSkillListLoading } =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trpc.skill.list.useQuery({ page: 1, limit: 100 } as any);

  // -- 스킬 목록을 셀렉터 옵션으로 변환 --
  const skillOptions: SkillOption[] = useMemo(() => {
    if (!skillListData?.skills) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return skillListData.skills.map((skill: any) => ({
      id: skill.id as string,
      label: `[${skill.code}] ${skill.title}` as string,
    }));
  }, [skillListData]);

  // -- 스킬 선택 핸들러 --
  const handleSkillSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSkillId(value || null);
    setPanelSkillId(null);
  }, []);

  // -- 깊이 변경 핸들러 --
  const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepth(Number(e.target.value));
  }, []);

  // -- 방향 변경 핸들러 --
  const handleDirectionChange = useCallback((nextDirection: Direction) => {
    setDirection(nextDirection);
  }, []);

  // -- 그래프 노드 클릭 핸들러 --
  const handleNodeClick = useCallback((skillId: string) => {
    setPanelSkillId(skillId);
  }, []);

  // -- 패널 닫기 핸들러 --
  const handlePanelClose = useCallback(() => {
    setPanelSkillId(null);
  }, []);

  // -- 문항 클릭 핸들러 (상세 페이지 이동) --
  const handleItemClick = useCallback(
    (itemId: string) => {
      router.push(`/items/${itemId}`);
    },
    [router],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      {/* 컨트롤 바 */}
      {isSkillListLoading ? (
        <ControlBarSkeleton />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          {/* 목록으로 돌아가기 */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link href={"/skills" as any}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              목록
            </Button>
          </Link>
          <PageHelp pageId="skills-graph" />

          <div className="h-6 w-px bg-slate-200" />

          {/* 스킬 셀렉터 */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="skill-selector"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              루트 스킬
            </label>
            <select
              id="skill-selector"
              value={selectedSkillId ?? ""}
              onChange={handleSkillSelect}
              className="h-9 min-w-[200px] rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            >
              <option value="">스킬 선택...</option>
              {skillOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* 깊이 선택 */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="depth-selector"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              깊이
            </label>
            <select
              id="depth-selector"
              value={depth}
              onChange={handleDepthChange}
              className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            >
              {DEPTH_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* 방향 세그먼트 컨트롤 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              방향
            </span>
            <div className="flex rounded-md border border-slate-200">
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleDirectionChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    direction === opt.value
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  } ${opt.value === "ancestors" ? "rounded-l-md" : ""} ${opt.value === "both" ? "rounded-r-md" : ""} ${opt.value !== "ancestors" ? "border-l border-slate-200" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 그래프 영역 */}
      {selectedSkillId === null ? (
        <EmptySelection />
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-200">
          <SkillGraph
            skillId={selectedSkillId}
            depth={depth}
            direction={direction}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}

      {/* 문항 패널 (오른쪽 오버레이) */}
      <SkillItemsPanel
        skillId={panelSkillId}
        onClose={handlePanelClose}
        onItemClick={handleItemClick}
      />
    </div>
  );
}
