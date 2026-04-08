"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";

export function HelpFab() {
  const pathname = usePathname();

  // 도움말 페이지에서는 FAB 숨김
  if (pathname === "/help") {
    return null;
  }

  return (
    <Link
      href="/help"
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
      aria-label="도움말"
    >
      <CircleHelp className="h-6 w-6" />
    </Link>
  );
}
