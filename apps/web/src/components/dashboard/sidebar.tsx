"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";

interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
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
    </aside>
  );
}
