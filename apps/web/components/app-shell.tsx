"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { HeaderBar } from "@/components/header-bar";
import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";
import type { SepNavResponse } from "@/lib/sep-nav";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  sepNav = { sections: [] },
}: {
  children: React.ReactNode;
  sepNav?: SepNavResponse;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-[#137832] dark:bg-[#083A17]">
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        sepNav={sepNav}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          collapsed ? "lg:pl-[65px]" : "lg:pl-[290px]"
        )}
      >
        <main className="flex h-full min-h-0 w-full flex-col p-2">
          <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-[#f4fbf7] dark:bg-[#040b07]">
            <HeaderBar
              leftSlot={
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Abrir menú"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-black/5 lg:hidden dark:text-zinc-300 dark:hover:bg-white/10"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              }
            />

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
          </section>
        </main>
      </div>

      <FloatingNav />
      <MobileFabNav />
    </div>
  );
}
