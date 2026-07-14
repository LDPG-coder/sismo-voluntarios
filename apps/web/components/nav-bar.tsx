"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  navItems,
  isNavActive,
  ActivitiesIcon,
  MyActivitiesIcon,
  CreateIcon,
  ProfileIcon,
  PublicProfileIcon,
  SettingsIcon,
  LogoutIcon,
} from "@/components/nav-config";
import { NotificationsBell } from "@/components/notifications-bell";
import { onPhotoChanged } from "@/lib/photo-events";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
  auth_source?: "google" | "sep";
  role?: "volunteer" | "admin";
};

export function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/me`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => {});

    const unsub = onPhotoChanged((photoUrl) => {
      setUser((prev) => (prev ? { ...prev, photo_url: photoUrl } : prev));
    });
    return unsub;
  }, []);

  const canCreate = user?.auth_source === "sep" || user?.role === "admin";

  return (
    <nav className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <Link
                  href="/voluntarios"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ActivitiesIcon className="h-4 w-4" />
                  Actividades
                </Link>
                <Link
                  href="/mis-actividades"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <MyActivitiesIcon className="h-4 w-4" />
                  Mis actividades
                </Link>
                {canCreate && (
                  <Link
                    href="/voluntarios/crear"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <CreateIcon className="h-4 w-4" />
                    Crear actividad
                  </Link>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <Link
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ProfileIcon className="h-4 w-4" />
                  Mi perfil
                </Link>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <a
                  href="/auth/logout"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <LogoutIcon className="h-4 w-4" />
                  Cerrar sesion
                </a>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canCreate && (
            <Link
              href="/voluntarios/crear"
              className="rounded-md bg-slate-900 p-2 text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              title="Crear actividad"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </Link>
          )}
          <NotificationsBell />
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Mi perfil"
            >
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
              <span className="hidden text-sm font-medium md:block">
                {user?.name || "Sin nombre"}
              </span>
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.name || "Sin nombre"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </p>
                  </div>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <Link
                    href="/perfil"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <PublicProfileIcon className="h-4 w-4" />
                    Ver perfil publico
                  </Link>
                  <Link
                    href="/perfil"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Configuracion
                  </Link>
                  <a
                    href="/auth/logout"
                    className="flex items-center justify-between px-4 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  >
                    <span>Cerrar sesion</span>
                    <LogoutIcon className="h-4 w-4 mr-1" />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
