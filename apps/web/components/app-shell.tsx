"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { HeaderBar } from "@/components/header-bar";
import { useSession } from "@/components/session-provider";
import type { SepNavItem } from "@/lib/sep-nav";

export function AppShell({
  children,
  sepNav = [],
}: {
  children: React.ReactNode;
  sepNav?: SepNavItem[];
}) {
  const [open, setOpen] = useState(false);
  const { user } = useSession();

  return (
    <div className="flex bg-[#f4f5f7] dark:bg-[#0c0b0a]">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} sepNav={sepNav} />

      <div className="flex min-w-0 flex-1 flex-col shadow-[0_0_60px_-28px_rgba(15,23,42,0.14)] dark:shadow-[-10px_0_24px_-12px_rgba(0,0,0,0.5)]">
        <HeaderBar
          leftSlot={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9eaec] text-zinc-700 transition hover:bg-[#f1f2f4] dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          }
        />

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
