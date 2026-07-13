"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isNavActive } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export function MobileFabNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          role="menu"
          aria-label="Navegacion del modulo"
          className="fixed bottom-20 right-4 z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          {navItems.map((item) => {
            const active = isNavActive(item, pathname);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "text-zinc-700 hover:bg-[#eaebed] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar navegacion" : "Abrir navegacion"}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/80 bg-white/90 text-emerald-600 shadow-lg shadow-zinc-900/10 backdrop-blur transition hover:bg-white hover:shadow-xl hover:shadow-zinc-900/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:shadow-emerald-500/40 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-emerald-400 dark:shadow-black/40 dark:hover:bg-zinc-900 dark:hover:shadow-black/60 dark:focus-visible:shadow-emerald-400/30"
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>
    </div>
  );
}
