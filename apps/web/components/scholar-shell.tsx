"use client";

import { useState } from "react";
import { ScholarSidebar } from "@/components/scholar-sidebar";
import { HeaderBar } from "@/components/header-bar";
import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";
import { SepBars3Icon } from "@/components/sep-icons";
import type { SepNavResponse } from "@/lib/sep-nav";
import { cn } from "@/lib/utils";

// White shell for SEP volunteers (scholars). Unlike the green AppShell used by
// SEP admins, scholars keep the light gray page background and a white sidebar
// that mirrors SEP's own scholar navigation. The hamburger is visible at every
// size (md+ slides the content over by the fixed md:w-72 sidebar).
export function ScholarShell({
  children,
  sepNav,
}: {
  children: React.ReactNode;
  sepNav: SepNavResponse;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#f4f5f7] dark:bg-[#0c0c0c]">
      <ScholarSidebar open={open} onClose={() => setOpen(false)} sepNav={sepNav} />

      <div className={cn("transition-[margin] duration-300 ease-in-out", open && "md:ml-72")}>
        <HeaderBar
          leftSlot={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <SepBars3Icon className="h-5 w-5" />
            </button>
          }
        />

        <main className="min-h-[calc(100dvh-57px)] px-3 py-4 md:px-6 md:py-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>

      <FloatingNav />
      <MobileFabNav />
    </div>
  );
}
