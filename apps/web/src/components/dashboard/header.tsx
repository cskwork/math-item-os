import { MobileSidebar } from "./mobile-sidebar";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <MobileSidebar />

      {/* 브레드크럼 영역 */}
      <div className="flex-1" />

      {/* 사용자 아바타 영역 */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
        U
      </div>
    </header>
  );
}
