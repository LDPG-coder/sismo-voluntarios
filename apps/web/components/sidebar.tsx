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
  CalendarIcon,
  ChartIcon,
  DocumentIcon,
  GlobeIcon,
  LogoutIcon,
} from "@/components/nav-config";
import type { SepNavItem } from "@/lib/sep-nav";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

const GREEN = "#00A650";

export function Sidebar({
  user,
  open,
  onClose,
  sepNav = [],
}: {
  user: User;
  open: boolean;
  onClose: () => void;
  sepNav?: SepNavItem[];
}) {
  const pathname = usePathname();
  const [volOpen, setVolOpen] = useState(true);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href;

  const sepNavContent =
    sepNav.length > 0 ? (
      <div>
        <Category>Portal SEP</Category>
        <div className="space-y-1">
          {sepNav.map((item) => (
            <SepNavLink key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />
          ))}
        </div>
      </div>
    ) : null;

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
        <NavLink href="#" label="Panel general" Icon={GridIcon} active={false} bold={false} onClick={onClose} />

        <div>
          <Category>Actividades</Category>
          <div className="space-y-1">
            <NavLink href="#" label="Actividades formativas" Icon={CapIcon} active={false} bold onClick={onClose} />
            <NavLink href="#" label="Chats" Icon={ChatIcon} active={false} bold onClick={onClose} />
            <button
              type="button"
              onClick={() => setVolOpen(!volOpen)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-transparent px-1.5 py-2.5 text-[13px] font-semibold text-[#333333] transition hover:bg-zinc-100 dark:text-[#E0E0E0] dark:hover:bg-zinc-800"
            >
              <RunIcon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">Voluntariado</span>
              <Chevron open={volOpen} />
            </button>
            {volOpen && (
              <div className="mt-1 space-y-1 pl-5">
                <SubLink href="/voluntarios" label="Voluntariado de Becarios" active={isActive("/voluntarios")} onClick={onClose} />
                <SubLink href="#" label="Registro" active={false} onClick={onClose} />
              </div>
            )}
            <NavLink href="#" label="Oferta de actividades" Icon={CalendarIcon} active={false} iconActive bold onClick={onClose} />
          </div>
        </div>

        {sepNavContent}

        <div>
          <Category>Análisis</Category>
          <div className="space-y-1">
            <NavLink href="#" label="Estadísticas" Icon={ChartIcon} active={false} bold={false} onClick={onClose} />
          </div>
        </div>

        <div>
          <Category>Otros componentes</Category>
          <div className="space-y-1">
            <NavLink href="#" label="Registro CVA" Icon={DocumentIcon} active={false} bold={false} onClick={onClose} />
            <NavLink href="#" label="Notas universitarias" Icon={CapIcon} active={false} bold={false} onClick={onClose} />
            <NavLink href="#" label="D.O.S Exchange Programs" Icon={GlobeIcon} active={false} bold={false} onClick={onClose} />
          </div>
        </div>
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

// Link to a SEP page. SEP pages may be served on the SEP domain (same origin as
// SISMO when proxied) or cross-origin; either way we open them in the same tab
// so SEP owns the navigation. The SEP session cookie is carried automatically
// for same-origin targets, so no extra token is appended here (see
// docs/SEP_INTEGRATION.md §2.2 for correlation params SEP may require).
function SepNavLink({
  item,
  active,
  onClick,
}: {
  item: SepNavItem;
  active: boolean;
  onClick: () => void;
}) {
  const external = !item.href.startsWith("/");
  const className = cn(
    "flex items-center gap-3 rounded-xl px-1.5 py-2.5 text-[13px] transition",
    active
      ? "bg-[#00A650]/10 text-[#00A650]"
      : "text-[#333333] hover:bg-zinc-100 dark:text-[#E0E0E0] dark:hover:bg-zinc-800",
  );
  if (external) {
    return (
      <a href={item.href} onClick={onClick} className={className} target="_self" rel="noopener">
        <GlobeIcon className="h-5 w-5 shrink-0" />
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={onClick} className={className}>
      <GlobeIcon className="h-5 w-5 shrink-0" />
      {item.label}
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
