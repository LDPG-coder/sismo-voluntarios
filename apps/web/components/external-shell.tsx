import Link from "next/link";
import { HeaderBar } from "@/components/header-bar";
import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";

// Shell for external (OAuth / Google) users. They get the same top header as SEP
// users (create, notifications, theme, profile menu with SISMO logout) but NOT
// the SEP-like sidebar: there is no hamburger/menu button and they keep
// navigating with the floating panel (desktop) and the FAB (phone). The profile
// menu logout is /auth/logout, which only ends the SISMO session and redirects
// to the SISMO login. See docs/external-users-access.md.
export function ExternalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-[#f4f5f7] dark:bg-[#0c0b0a]">
      <HeaderBar
        leftSlot={
          <Link
            href="/"
            aria-label="Sismo Voluntarios - inicio"
            className="flex items-center gap-2 rounded-md px-1 transition hover:opacity-80"
          >
            <img src="/icon-wtbg.png" alt="Sismo Voluntarios" className="h-9 w-9 rounded-md border border-zinc-200 object-contain shadow-sm dark:border-zinc-700" />
            <span className="hidden text-sm font-semibold tracking-tight text-zinc-800 sm:inline dark:text-zinc-100">
              Sismo Voluntarios
            </span>
          </Link>
        }
      />
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 pr-4 lg:pb-4 lg:pr-24">
        {children}
      </div>
      <FloatingNav />
      <MobileFabNav />
    </div>
  );
}
