"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  GridIcon,
  CalendarIcon,
  GlobeIcon,
} from "@/components/nav-config";
import {
  SepWorkshopIcon,
  SepChatIcon,
  SepVolunteerIcon,
  SepLinkIcon,
  SepChartBarIcon,
  SepDocumentTextIcon,
  SepAcademicCapIcon,
} from "@/components/sep-icons";
import type { SepNavResponse, SepNavGroup } from "@/lib/sep-nav";

type User = {
  name: string | null;
  photo_url: string | null;
  email: string;
} | null;

const SEP_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || "http://localhost:3000";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const MOBILE_QUERY = "(max-width: 767px)";

const LABEL_ICONS: Record<string, ReactNode> = {
  "Panel general": <GridIcon />,
  "Actividades formativas": <SepWorkshopIcon />,
  Chats: <SepChatIcon />,
  Voluntariado: <SepVolunteerIcon />,
  "Oferta de actividades": <CalendarIcon className="text-[#2fc122]" />,
  Voluntariados: <SepLinkIcon className="text-[#2fc122]" />,
  Estadísticas: <SepChartBarIcon />,
  "Registro CVA": <SepDocumentTextIcon />,
  "Notas universitarias": <SepAcademicCapIcon />,
  "D.O.S Exchange Programs": <GlobeIcon />,
};

function iconFor(label: string): ReactNode {
  return LABEL_ICONS[label] ?? <GlobeIcon />;
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
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
        />
      )}

      <aside
        aria-label="Menú principal"
        className={cn(
          "fixed left-0 top-0 z-30 flex h-[100dvh] w-[86vw] max-w-[340px] flex-col overflow-hidden rounded-r-lg border-r border-black/[0.07] bg-white shadow-[0_16px_40px_rgba(4,9,1,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:border-white/[0.08] dark:bg-black md:w-72 md:max-w-none md:rounded-none md:shadow-none md:translate-x-0",
          open ? "z-[70] translate-x-0" : "z-30 -translate-x-full"
        )}
      >
        <div className="flex h-[57px] shrink-0 items-center justify-between gap-2 border-b border-black/[0.05] px-4 dark:border-white/[0.06] md:justify-center md:px-5">
          <img
            src={`${BASE_PATH}/sidebar/proexcelencia-color.avif`}
            alt="ProExcelencia"
            className="h-auto w-[150px] md:w-[170px]"
          />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 md:hidden"
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

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
          {sepNav.sections.map((sec, idx) => (
            <div key={sec.section}>
              {idx > 0 && <SectionSeparator label={sec.section} />}
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

function IconSlot({ icon }: { icon: ReactNode }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
      {icon}
    </span>
  );
}

function ItemLink({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={resolveHref(href)}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm transition-colors duration-200",
        active
          ? "bg-[#f2fdf0] font-semibold text-[#1d8015] dark:bg-[#2fc122]/20 dark:text-[#2fc122]"
          : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
      )}
    >
      <IconSlot icon={icon} />
      <span className="flex-1 whitespace-nowrap text-left">{label}</span>
    </a>
  );
}

function ItemGroup({
  group,
  icon,
  active,
  onClick,
}: {
  group: SepNavGroup;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const pathname = usePathname();
  const [isOpen, setOpen] = useState(false);

  // Collapse expanded groups after navigating on mobile.
  useEffect(() => {
    if (window.innerWidth <= 768) setOpen(false);
  }, [pathname]);

  const toggle = () => setOpen((v) => !v);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm transition-colors duration-200",
          active
            ? "bg-[#f2fdf0] font-semibold text-[#1d8015] dark:bg-[#2fc122]/20 dark:text-[#2fc122]"
            : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
        )}
      >
        <IconSlot icon={icon} />
        <span className="flex-1 whitespace-nowrap text-left">{group.label}</span>
        <span
          className={cn(
            "block h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25 12 15.75 4.5 8.25"
            />
          </svg>
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
