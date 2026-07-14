"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { LogoutIcon } from "@/components/nav-config";
import { onPhotoChanged } from "@/lib/photo-events";
import { useSession, type SessionUser } from "@/components/session-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const { user, setUser } = useSession();
  const lastScroll = useRef(0);

  // TEMPORAL (ver docs/external-users-access.md): también los usuarios externos
  // (google) pueden crear actividades.
  // const canCreate = user?.auth_source === "sep" || user?.role === "admin";
  const canCreate =
    user?.auth_source === "sep" || user?.role === "admin" || user?.auth_source === "google";

  useEffect(() => {
    const unsub = onPhotoChanged((photoUrl) => {
      setUser((prev: SessionUser) =>
        prev ? { ...prev, photo_url: photoUrl } : prev
      );
    });
    return unsub;
  }, [setUser]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScroll.current && y > 80) {
        setHeaderHidden(true);
      } else if (y < lastScroll.current) {
        setHeaderHidden(false);
      }
      lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f4f5f7] dark:bg-[#0c0b0a]">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col shadow-[0_0_60px_-28px_rgba(15,23,42,0.14)] dark:shadow-[-10px_0_24px_-12px_rgba(0,0,0,0.5)]">
        {/* TODO(prueba): header visible en escritorio durante la simulacion
            SEP (top + side bar a la vez). Revertir: volver a `lg:hidden`. */}
        <header className={`sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200/70 bg-[#f4f5f7]/80 px-4 py-3 backdrop-blur transition-transform duration-300 dark:border-zinc-800/70 dark:bg-[#0c0b0a]/80 ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9eaec] text-zinc-700 transition hover:bg-[#f1f2f4] dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-1">
            {canCreate && (
              <Link
                href="/voluntarios/crear"
                aria-label="Crear actividad"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </Link>
            )}
            <NotificationsBell />
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Mi perfil"
                className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-[#eaebed] transition dark:bg-zinc-800"
              >
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg className="h-5 w-5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                )}
                <span className="pointer-events-none absolute inset-0 rounded-md bg-black opacity-0 transition-opacity duration-200 group-hover:opacity-20" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-[#18181b]">
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {user?.name || "Sin nombre"}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {user?.email}
                      </p>
                    </div>
                    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                    <Link
                      href="/perfil"
                      onClick={() => setProfileOpen(false)}
                      className="mx-1 block rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Ver perfil público
                    </Link>
                    <Link
                      href="/perfil"
                      onClick={() => setProfileOpen(false)}
                      className="mx-1 block rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Configuración
                    </Link>
                    <a
                      href="/auth/logout"
                      className="mx-1 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                    >
                      <span>Cerrar sesion</span>
                      <LogoutIcon className="h-4 w-4 mr-1" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* TODO(prueba): deja espacio a la derecha para el panel flotante
            del modo SEP durante la simulacion. Quitar al restaurar modo real. */}
        <div className="flex-1 lg:pr-24">{children}</div>
      </div>
    </div>
  );
}
