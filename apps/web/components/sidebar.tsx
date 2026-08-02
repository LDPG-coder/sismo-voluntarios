"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SepDashboardIcon,
  SepWorkshopIcon,
  SepChatIcon,
  SepVolunteerIcon,
  SepUserIcon,
  SepLinkIcon,
  SepChevronIcon,
} from "@/components/sep-icons";
import type { SepNavResponse, SepNavGroup } from "@/lib/sep-nav";

const SEP_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || "http://localhost:3000";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const MOBILE_QUERY = "(max-width: 1023px)";

// Icon map mirrors the SEP admin sidebar (src/components/admin/navigation).
// Labels come from the SEP /api/navigation endpoint and stay in Spanish.
const LABEL_ICONS: Record<string, ReactNode> = {
  "Panel general": <SepDashboardIcon />,
  "Actividades formativas": <SepWorkshopIcon />,
  "Chat clubs de inglés": <SepChatIcon />,
  Chats: <SepChatIcon />,
  Voluntariado: <SepVolunteerIcon />,
  "Voluntariado de Becarios": <SepVolunteerIcon />,
  Becarios: <SepUserIcon />,
  Mentores: <SepUserIcon />,
  Captación: <SepUserIcon />,
  "Formulario de postulación": <SepLinkIcon />,
};

function iconFor(label: string): ReactNode {
  return LABEL_ICONS[label] ?? <SepLinkIcon />;
}

function resolveHref(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, SEP_ORIGIN).toString();
}

function internalPath(href: string): string {
  let pathname: string;
  try {
    pathname = new URL(href).pathname;
  } catch {
    pathname = href;
  }
  if (
    BASE_PATH &&
    (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))
  ) {
    const rest = pathname.slice(BASE_PATH.length);
    return rest === "" || rest === "/" ? "/" : rest;
  }
  return pathname;
}

function isLinkActive(href: string, pathname: string): boolean {
  return pathname === internalPath(resolveHref(href));
}

export function Sidebar({
  open,
  onClose,
  sepNav = { sections: [] },
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  sepNav?: SepNavResponse;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  // Below lg the sidebar is a drawer, so the collapsed state is ignored: labels,
  // groups and separators always render full width (mirrors SEP's useMobile()).
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const effectiveCollapsed = isNarrow ? false : collapsed;

  // Close the drawer after navigating on mobile — the chosen route is now behind it.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (window.matchMedia(MOBILE_QUERY).matches) onCloseRef.current();
  }, [pathname]);

  // Mobile drawer behaves like a modal: lock the page, close on Escape, focus
  // the close button. The lock follows the breakpoint so crossing to lg+ while
  // open frees scroll and closes the drawer.
  useEffect(() => {
    if (!open) return;

    const mobile = window.matchMedia(MOBILE_QUERY);
    if (!mobile.matches) return;

    const previousOverflow = document.body.style.overflow;
    const syncScrollLock = () => {
      if (mobile.matches) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = previousOverflow;
        onCloseRef.current();
      }
    };
    syncScrollLock();
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    mobile.addEventListener("change", syncScrollLock);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      mobile.removeEventListener("change", syncScrollLock);
    };
  }, [open]);

  const closeDrawer = () => onCloseRef.current();

  const renderGroup = (group: SepNavGroup, sectionName: string) => {
    const hasItems = !!group.items && group.items.length > 0;
    const key = `${sectionName}/${group.label}`;
    const icon = iconFor(group.label);
    const rowActive =
      (group.href !== null && isLinkActive(group.href, pathname)) ||
      (hasItems
        ? group.items!.some((sub) => isLinkActive(sub.href, pathname))
        : false);

    if (!hasItems && group.href !== null) {
      return (
        <ItemLink
          key={key}
          href={group.href}
          label={group.label}
          icon={icon}
          active={rowActive}
          collapsed={effectiveCollapsed}
          onClick={closeDrawer}
        />
      );
    }
    return (
      <ItemGroup
        key={key}
        group={group}
        icon={icon}
        active={rowActive}
        collapsed={effectiveCollapsed}
        onClick={closeDrawer}
      />
    );
  };

  return (
    <>
      {open && (
        <div
          onClick={closeDrawer}
          aria-hidden="true"
          className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
        />
      )}

      <aside
        aria-label="Menú principal"
        className={cn(
          "fixed left-0 top-0 z-30 flex h-[100dvh] w-[86vw] max-w-[340px] flex-col overflow-hidden rounded-r-lg bg-[#137832] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:bg-[#083A17] lg:max-w-none lg:rounded-none lg:overflow-visible lg:bg-transparent",
          collapsed ? "lg:w-[65px]" : "lg:w-[290px]",
          open ? "z-[70] translate-x-0" : "z-30 -translate-x-full lg:translate-x-0 lg:z-40"
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className="absolute -right-[27px] top-[1px] z-50 hidden h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 lg:flex dark:bg-zinc-800 dark:text-zinc-200"
        >
          <svg
            className={cn(
              "h-4 w-4 transition-transform duration-700 ease-in-out",
              collapsed && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        <div className="flex h-[57px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.05] px-4 dark:border-white/[0.06] lg:justify-center lg:border-b-0 lg:px-0">
          <div className="flex items-center gap-1">
            <img
              src={`${BASE_PATH}/sidebar/logo-proexcelencia-cap-white-80.avif`}
              alt="ProExcelencia"
              className="h-10 w-10 shrink-0"
            />
            <img
              src={`${BASE_PATH}/sidebar/logo-proexcelencia-words-white-280.avif`}
              alt=""
              className={cn(
                "h-3.5 w-[140px] transition-[transform,opacity] duration-300",
                effectiveCollapsed && "-translate-x-96 opacity-0 hidden"
              )}
            />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto",
            effectiveCollapsed
              ? "flex flex-col items-center gap-2 px-0 py-4"
              : "flex flex-col gap-2 px-3 py-4"
          )}
        >
          {sepNav.sections.map((sec, idx) => (
            <div
              key={sec.section}
              className={cn("w-full", effectiveCollapsed && "flex flex-col items-center")}
            >
              {idx > 0 && (
                <SectionSeparator label={sec.section} collapsed={effectiveCollapsed} />
              )}
              <ul className="space-y-2">
                {sec.items.map((group) => (
                  <li key={`${sec.section}/${group.label}`}>
                    {renderGroup(group, sec.section)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function SectionSeparator({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (!collapsed) {
    return (
      <p className="max-w-[248px] truncate px-3 pb-1 pt-2 text-xs font-medium text-gray-500 dark:text-gray-500">
        {label}
      </p>
    );
  }
  return (
    <div className="flex w-full items-center justify-center p-1">
      <MoreHorizontal className="h-6 w-6 text-white" />
    </div>
  );
}

function IconSlot({ icon }: { icon: ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
      {icon}
    </span>
  );
}

function ItemLink({
  href,
  label,
  icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={resolveHref(href)}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-11 items-center rounded-md text-white transition-colors duration-200",
        collapsed ? "w-11 justify-center" : "w-full justify-start gap-3 px-3 text-sm font-medium",
        active ? "bg-white/20" : "hover:bg-white/10"
      )}
    >
      <IconSlot icon={icon} />
      {!collapsed && <span className="flex-1 whitespace-nowrap text-left">{label}</span>}
    </a>
  );
}

function ItemGroup({
  group,
  icon,
  active,
  collapsed,
  onClick,
}: {
  group: SepNavGroup;
  icon: ReactNode;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const [isOpen, setOpen] = useState(false);

  // Collapse expanded groups after navigating on mobile.
  useEffect(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setOpen(false);
  }, [pathname]);

  // When the sidebar is collapsed only the icon is shown. Groups without a
  // target link are not reachable until expanded again.
  if (collapsed) {
    if (group.href !== null) {
      return (
        <ItemLink
          href={group.href}
          label={group.label}
          icon={icon}
          active={active}
          collapsed
          onClick={onClick}
        />
      );
    }
    return (
      <span
        title={group.label}
        className="flex h-11 w-11 items-center justify-center rounded-md text-white/80"
      >
        <IconSlot icon={icon} />
      </span>
    );
  }

  const toggle = () => setOpen((v) => !v);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm font-medium text-white transition-colors duration-200",
          active ? "bg-white/20" : "hover:bg-white/10"
        )}
      >
        <IconSlot icon={icon} />
        <span className="flex-1 whitespace-nowrap text-left">{group.label}</span>
        <span
          className={cn(
            "block h-4 w-4 shrink-0 text-white/80 transition-transform duration-200 [&>svg]:h-full [&>svg]:w-full",
            isOpen && "rotate-180"
          )}
        >
          <SepChevronIcon />
        </span>
      </button>
      {isOpen && (
        <ul className="mt-1 space-y-0.5">
          {group.items!.map((sub) => {
            const subActive = isLinkActive(sub.href, pathname);
            return (
              <li key={`${sub.label}/${sub.href}`}>
                <a
                  href={resolveHref(sub.href)}
                  onClick={onClick}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md py-2 pl-8 pr-3 text-sm text-white transition-colors duration-200",
                    subActive ? "bg-white/20" : "hover:bg-white/10"
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 shrink-0 rounded-full",
                      subActive ? "bg-white" : "bg-gray-200"
                    )}
                  />
                  {sub.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
