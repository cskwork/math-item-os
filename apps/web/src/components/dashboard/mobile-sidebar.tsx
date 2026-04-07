"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-slate-900 p-0 text-white">
        <SheetTitle className="sr-only">내비게이션 메뉴</SheetTitle>
        <div className="flex h-14 items-center border-b border-slate-700 px-4">
          <span className="text-base font-bold tracking-tight">
            Math Item OS
          </span>
        </div>
        <div className="py-3">
          <SidebarNav collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
