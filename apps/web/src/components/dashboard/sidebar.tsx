"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarNav } from "./sidebar-nav";

interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const isGuideActive = pathname.startsWith("/guide");

  const guideLink = (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={"/guide" as any}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isGuideActive
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white",
        collapsed && "justify-center px-2",
      )}
    >
      <Route className="h-4 w-4 shrink-0" />
      {!collapsed && <span>서비스 흐름</span>}
    </Link>
  );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-slate-900 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* 로고 영역 */}
      <div className="flex h-14 items-center justify-between border-b border-slate-700 px-3">
        {!collapsed && (
          <span className="text-base font-bold tracking-tight">
            Math Item OS
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 네비게이션 */}
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>

      {/* 하단 고정 메뉴 */}
      <div className="border-t border-slate-700 px-2 py-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{guideLink}</TooltipTrigger>
            <TooltipContent side="right">서비스 흐름</TooltipContent>
          </Tooltip>
        ) : (
          guideLink
        )}
      </div>
    </aside>
  );
}
