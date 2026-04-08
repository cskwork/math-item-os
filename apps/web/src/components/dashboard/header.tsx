import { Breadcrumb } from "./breadcrumb";
import { MobileSidebar } from "./mobile-sidebar";
import { UserMenu } from "./user-menu";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <MobileSidebar />
      <div className="flex-1">
        <Breadcrumb />
      </div>
      <UserMenu />
    </header>
  );
}
