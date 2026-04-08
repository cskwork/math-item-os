"use client";

import { useSession, signOut } from "next-auth/react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

function getInitial(name?: string | null, email?: string | null): string {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return "U";
}

function AvatarButton({ initial }: { initial: string }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300"
    >
      {initial}
    </button>
  );
}

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
        U
      </div>
    );
  }

  const userName = session?.user?.name;
  const userEmail = session?.user?.email;
  const initial = getInitial(userName, userEmail);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <AvatarButton initial={initial} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="px-4 py-3">
          {userName && (
            <p className="text-sm font-medium text-slate-900">{userName}</p>
          )}
          {userEmail && (
            <p className="text-xs text-slate-500">{userEmail}</p>
          )}
        </div>
        <div className="border-t border-slate-200" />
        <div className="p-1">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            로그아웃
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
