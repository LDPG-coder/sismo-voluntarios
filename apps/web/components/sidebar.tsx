"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

const navItems = [
  { href: "/voluntarios", label: "Actividades", icon: ActivitiesIcon },
  { href: "/mis-actividades", label: "Mis actividades", icon: MyActivitiesIcon },
  { href: "/voluntarios/crear", label: "Crear", icon: CreateIcon },
  { href: "/perfil", label: "Mi perfil", icon: ProfileIcon },
];

export function Sidebar({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/voluntarios"
      ? pathname === "/voluntarios" || pathname.startsWith("/voluntarios/")
      : pathname === href;

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
          SV
        </span>
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Sismo Voluntarios
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const isCreate = item.href === "/voluntarios/crear";
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isCreate
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  : active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "text-slate-700 hover:bg-[#eaebed] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
            >
              {item.href === "/perfil" ? (
                user?.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <Icon />
                )
              ) : (
                <Icon />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <a
          href="/auth/logout"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <LogoutIcon />
          Cerrar sesion
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col dark:border-slate-800 dark:bg-slate-950">
        {navContent}
      </aside>

      {open && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

function ActivitiesIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function MyActivitiesIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  );
}
