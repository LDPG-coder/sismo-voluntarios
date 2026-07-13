"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { navItems, isNavActive, LogoutIcon } from "@/components/nav-config";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

export function Sidebar({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          SV
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Sismo Voluntarios
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition",
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "text-zinc-700 hover:bg-[#eaebed] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <a
          href="/auth/logout"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          Cerrar sesion
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden rounded-r-lg border-r border-zinc-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        {navContent}
      </aside>

      {open && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 rounded-r-lg border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
