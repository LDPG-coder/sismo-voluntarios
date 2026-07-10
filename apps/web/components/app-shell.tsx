"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/me`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] dark:bg-[#0c0b0a]">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col shadow-[-10px_0_24px_-12px_rgba(15,23,42,0.12)] dark:shadow-[-10px_0_24px_-12px_rgba(0,0,0,0.5)]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200/70 bg-[#f4f5f7]/80 px-4 py-2 backdrop-blur dark:border-zinc-800/70 dark:bg-[#0c0b0a]/80 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 transition hover:bg-[#eaebed] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            <Link
              href="/voluntarios/crear"
              aria-label="Crear actividad"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </Link>
            <NotificationsBell />
            <ThemeToggle />
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-[#eaebed] dark:bg-zinc-800">
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg className="h-5 w-5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
