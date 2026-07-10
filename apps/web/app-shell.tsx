"use client";

import { useEffect, useState } from "react";
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-[#eaebed] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            <NotificationsBell />
            <ThemeToggle />
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#eaebed] dark:bg-slate-800">
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
