"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SepWorkshopIcon,
  SepChatIcon,
  SepVolunteerIcon,
  SepLinkIcon,
  SepChevronIcon,
  SepSquares2X2Icon,
  SepCalendarDaysIcon,
  SepChartBarIcon,
  SepDocumentTextIcon,
  SepAcademicCapIcon,
  SepGlobeAmericasIcon,
  SepXMarkIcon,
} from "@/components/sep-icons";
import type { SepNavResponse, SepNavGroup } from "@/lib/sep-nav";

const SEP_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || "http://localhost:3000";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const MOBILE_QUERY = "(max-width: 767px)";

// Icon map mirrors the SEP scholar sidebar (src/components/scholar/Sidebar.tsx).
// Labels come from the SEP /api/navigation endpoint and stay in Spanish.
const LABEL_ICONS: Record<string, ReactNode> = {
  "Panel general": <SepSquares2X2Icon />,
  "Actividades formativas": <SepWorkshopIcon />,
  Chats: <SepChatIcon />,
  Voluntariado: <SepVolunteerIcon />,
  "Oferta de actividades": <SepCalendarDaysIcon />,
  Estadísticas: <SepChartBarIcon />,
  "Registro CVA": <SepDocumentTextIcon />,
  "Notas universitarias": <SepAcademicCapIcon />,
  "D.O.S Exchange Programs": <SepGlobeAmericasIcon />,
};

// In SEP the "Oferta de actividades" calendar icon is tinted green (text-primary-1).
const GREEN_ICON_LABEL = "Oferta de actividades";

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

// The "Voluntariado de Becarios" item points at the SEP SSO endpoint
// (/api/sismo/sso), which mints the session that lands the user here. This
// sidebar only renders inside sismo, so whenever it is visible the user is
// inside sismo and that bridge item is the active "page".
const SISMO_SSO_PATH = "/api/sismo/sso";

function isSismoSsoHref(href: string): boolean {
  return internalPath(resolveHref(href)) === SISMO_SSO_PATH;
}

export function ScholarSidebar({
  open,
  onClose,
  sepNav,
}: {
  open: boolean;
  onClose: () => void;
  sepNav: SepNavResponse;
}) {
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  // Close the drawer after navigating on mobile — the chosen route is now behind it.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (window.matchMedia(MOBILE_QUERY).matches) onCloseRef.current();
  }, [pathname]);

  // Mobile drawer behaves like a modal: lock the page, close on Escape, focus
  // the close button. The lock follows the breakpoint so crossing to md+ while
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
        ? group.items!.some(
            (sub) => isLinkActive(sub.href, pathname) || isSismoSsoHref(sub.href)
          )
        : false);
    const greenIcon = group.label === GREEN_ICON_LABEL;

    if (!hasItems && group.href !== null && group.href !== "") {
      return (
        <ItemLink
          key={key}
          href={group.href}
          label={group.label}
          icon={icon}
          active={rowActive}
          greenIcon={greenIcon}
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
        greenIcon={greenIcon}
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
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none dark:bg-black/70 md:hidden"
        />
      )}

      <aside
        aria-label="Menú principal"
        aria-hidden={!open}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-[100dvh] w-[86vw] max-w-[340px] flex-col overflow-hidden rounded-r-lg border-r border-black/[0.07] bg-white shadow-[0_16px_40px_rgba(4,9,1,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:border-white/[0.08] dark:bg-black md:w-72 md:max-w-none md:rounded-none md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[57px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.05] px-4 dark:border-white/[0.06] md:justify-center md:px-5">
          <a
            href={SEP_ORIGIN + "/becario/panel"}
            aria-label="Ir al panel general"
            className="flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#2fc122]/60"
          >
            <img
              src={`${BASE_PATH}/sidebar/proexcelencia-color.avif`}
              alt="ProExcelencia"
              className="h-auto w-[150px] md:w-[170px]"
            />
          </a>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 md:hidden"
          >
            <SepXMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
          {sepNav.sections.map((sec, idx) => (
            <div key={sec.section} className="w-full">
              {idx > 0 && sec.items.length > 0 && (
                <SectionSeparator label={sec.section} />
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

function SectionSeparator({ label }: { label: string }) {
  return (
    <p className="max-w-[248px] truncate px-3 pb-1 pt-2 text-xs font-medium text-gray-500 dark:text-gray-500">
      {label}
    </p>
  );
}

function IconSlot({ icon, green }: { icon: ReactNode; green?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full",
        green && "text-[#2fc122]"
      )}
    >
      {icon}
    </span>
  );
}

function rowClasses(active: boolean): string {
  return cn(
    "flex h-11 w-full items-center justify-start gap-3 px-3 text-sm transition-colors duration-200",
    active
      ? "font-semibold bg-[#f2fdf0] text-[#1d8015] dark:bg-[#2fc122]/20 dark:text-[#2fc122]"
      : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
  );
}

function ItemLink({
  href,
  label,
  icon,
  active,
  greenIcon,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  greenIcon: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={resolveHref(href)}
      onClick={onClick}
      className={rowClasses(active)}
    >
      <IconSlot icon={icon} green={greenIcon} />
      <span className="flex-1 whitespace-nowrap text-left">{label}</span>
    </a>
  );
}

function ItemGroup({
  group,
  icon,
  active,
  greenIcon,
  onClick,
}: {
  group: SepNavGroup;
  icon: ReactNode;
  active: boolean;
  greenIcon: boolean;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const [isOpen, setOpen] = useState(false);

  // Collapse expanded groups after navigating on mobile.
  useEffect(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setOpen(false);
  }, [pathname]);

  const hasItems = !!group.items && group.items.length > 0;
  const isInert = !hasItems && (group.href === null || group.href === "");

  if (isInert) {
    return (
      <button type="button" className={rowClasses(active)}>
        <IconSlot icon={icon} green={greenIcon} />
        <span className="flex-1 whitespace-nowrap text-left">{group.label}</span>
      </button>
    );
  }

  const toggle = () => setOpen((v) => !v);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className={rowClasses(active)}
      >
        <IconSlot icon={icon} green={greenIcon} />
        <span className="flex-1 whitespace-nowrap text-left">{group.label}</span>
        <span
          className={cn(
            "block h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 [&>svg]:h-full [&>svg]:w-full",
            isOpen && "rotate-180"
          )}
        >
          <SepChevronIcon />
        </span>
      </button>
      {isOpen && hasItems && (
        <ul className="mt-1 space-y-0.5">
          {group.items!.map((sub) => {
            const subActive =
              isLinkActive(sub.href, pathname) || isSismoSsoHref(sub.href);
            return (
              <li key={`${sub.label}/${sub.href}`}>
                <a
                  href={resolveHref(sub.href)}
                  onClick={onClick}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md py-2 pl-11 pr-3 text-sm transition-colors duration-200",
                    subActive
                      ? "font-medium text-[#1d8015] dark:text-[#2fc122]"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200",
                      subActive
                        ? "bg-[#23a217] dark:bg-[#2fc122]"
                        : "bg-gray-300 dark:bg-gray-600"
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
