"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isNavActive, GridIcon } from "@/components/nav-config";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function FloatingNav() {
  const [expanded, setExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch(`${API}/api/v1/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAdmin(data?.role === "admin"))
      .catch(() => {});
  }, []);

  const items = isAdmin
    ? [
        ...navItems,
        { href: "/admin", label: "Administrar", Icon: GridIcon },
      ]
    : navItems;

  return (
    <nav
      aria-label="Navegacion del modulo"
      className={cn(
        "fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col rounded-2xl border border-zinc-200/40 bg-white/50 p-2 shadow-md shadow-zinc-900/5 backdrop-blur transition-all duration-200 hover:border-zinc-200/70 hover:bg-white/90 hover:shadow-lg hover:shadow-zinc-900/10 lg:flex dark:border-zinc-800/40 dark:bg-zinc-950/50 dark:hover:border-zinc-800/70 dark:hover:bg-zinc-950/90 dark:hover:shadow-black/40",
        expanded ? "w-56" : "w-[60px]",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Contraer navegacion" : "Expandir navegacion"}
        aria-expanded={expanded}
        className="mb-1 flex h-9 w-full items-center justify-center rounded-xl text-zinc-500 transition hover:bg-[#eaebed] dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg
          className={cn("h-5 w-5 transition-transform duration-200", expanded && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "text-zinc-700 hover:bg-[#eaebed] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
