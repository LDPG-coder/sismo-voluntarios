"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  GridIcon,
  CapIcon,
  ChatIcon,
  RunIcon,
  VolunteersIcon,
  CalendarIcon,
  GlobeIcon,
  LogoutIcon,
} from "@/components/nav-config";
import type {
  SepNavResponse,
  SepNavSection,
  SepNavGroup,
} from "@/lib/sep-nav";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

const GREEN = "#00A650";

/** Map SEP group labels to sismo icons. */
const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "Actividades formativas": CapIcon,
  "Chat clubs de inglés": ChatIcon,
  Voluntariado: RunIcon,
  Becarios: VolunteersIcon,
  Mentores: VolunteersIcon,
  Captación: VolunteersIcon,
  "Acciones de administrador": VolunteersIcon,
};

/** Map SEP section names to a default icon for direct-link items. */
const SECTION_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Panel: GridIcon,
  Mentoria: VolunteersIcon,
  Captacion: VolunteersIcon,
};

export function Sidebar({
  user,
  open,
  onClose,
  sepNav = { sections: [] },
}: {
  user: User;
  open: boolean;
  onClose: () => void;
  sepNav?: SepNavResponse;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href;

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  /** No injection needed — sismo link comes from the SEP API response. */
  const resolveGroup = (group: SepNavGroup, _sectionName: string): SepNavGroup => {
    return group;
  };

  const renderGroup = (group: SepNavGroup, sectionName: string) => {
    const resolved = resolveGroup(group, sectionName);
    const hasItems = resolved.items && resolved.items.length > 0;
    const groupKey = `${sectionName}/${resolved.label}`;
    const isOpen = openGroups[groupKey] ?? hasItems;
    const Icon = GROUP_ICONS[resolved.label] ?? GlobeIcon;

    // Direct link only (no sub-items) — render as NavLink
    if (!hasItems && resolved.href) {
      return (
        <NavLink
          key={groupKey}
          href={resolved.href}
          label={resolved.label}
          Icon={Icon}
          active={isActive(resolved.href)}
          bold
          onClick={onClose}
        />
      );
    }

    // Group with sub-items — render as collapsible
    return (
      <div key={groupKey}>
        <button
          type="button"
          onClick={() => toggleGroup(groupKey)}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-transparent px-1.5 py-2.5 text-[13px] font-semibold text-[#333333] transition hover:bg-zinc-100 dark:text-[#E0E0E0] dark:hover:bg-zinc-800"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{resolved.label}</span>
          <Chevron open={isOpen} />
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1 pl-5">
            {resolved.items!.map((sub) => (
              <SubLink
                key={sub.href}
                href={sub.href}
                label={sub.label}
                active={isActive(sub.href)}
                onClick={onClose}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const navContent = (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-[#121212]">
      <div className="flex h-16 items-center justify-between px-4">
        <img src="/sidebar/logo.png" alt="PROEXCELENCIA" className="h-8 w-auto" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
        {sepNav.sections.map((sec) => (
          <div key={sec.section}>
            {sec.section !== "Panel" && <Category>{sec.section}</Category>}
            <div className="space-y-1">
              {sec.items.map((group) => renderGroup(group, sec.section))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <a
          href="/auth/logout"
          className="flex items-center gap-3 rounded-xl px-1.5 py-2.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          Cerrar sesión
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden border-zinc-200 lg:sticky lg:top-3 lg:z-30 lg:flex lg:h-[calc(100vh-1.5rem)] lg:w-72 lg:flex-col lg:m-3 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-zinc-200 dark:border-zinc-800">
        {navContent}
      </aside>

      {open && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 overflow-hidden rounded-r-2xl border-r border-zinc-200 dark:border-zinc-800">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

function Category({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1.5 text-[11px] font-normal uppercase tracking-wide text-[#757575] dark:text-[#888888]">
      {children}
    </p>
  );
}

function NavLink({
  href,
  label,
  Icon,
  active,
  bold,
  iconActive,
  onClick,
}: {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
  bold: boolean;
  iconActive?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-1.5 py-2.5 text-[13px] transition",
        bold ? "font-semibold" : "font-normal",
        active
          ? "bg-[#00A650]/10 text-[#00A650]"
          : "text-[#333333] hover:bg-zinc-100 dark:text-[#E0E0E0] dark:hover:bg-zinc-800"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", iconActive && "text-[#00A650]")} />
      {label}
    </Link>
  );
}

function SubLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-1.5 py-2 text-[13px] transition",
        active
          ? "text-[#00A650]"
          : "text-[#757575] hover:text-[#333333] dark:text-[#888888] dark:hover:text-[#E0E0E0]"
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#bbbbbb] dark:bg-[#888888]" />
      {label}
    </Link>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25 12 15.75 4.5 8.25" />
    </svg>
  );
}
