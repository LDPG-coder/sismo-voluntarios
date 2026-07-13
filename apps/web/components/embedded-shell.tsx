import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";

export function EmbeddedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#f4f5f7] dark:bg-[#0c0b0a]">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 pr-4 lg:pr-24">
        {children}
      </div>
      <FloatingNav />
      <MobileFabNav />
    </div>
  );
}
