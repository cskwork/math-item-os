"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navSections, type NavItem } from "./nav-config";

interface SidebarNavProps {
  readonly collapsed: boolean;
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  readonly item: NavItem;
  readonly isActive: boolean;
  readonly collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={item.href as any}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navSections.map((section, sectionIndex) => (
        <div key={section.label ?? `section-${sectionIndex}`}>
          {sectionIndex > 0 && (
            <>
              <Separator className="my-3 bg-slate-700" />
              {section.label && !collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.label}
                </p>
              )}
            </>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
