import { fetchCurrentUser } from "@/lib/auth/me";
import { getEmbedContext } from "@/lib/auth/embed";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";
import { EmbeddedShell } from "@/components/embedded-shell";
import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";

// SEP users are rendered without SISMO's own header/sidebar (the SEP platform
// supplies its own chrome); they use the floating navigation instead. Detection
// is driven by the user's auth_source ("sep") and falls back to the request
// context header/cookie injected by the SEP proxy (getEmbedContext).
export default async function AppLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await fetchCurrentUser();
  const sp = await searchParams;
  const embedCtx = await getEmbedContext(sp);
  const isSep = user?.auth_source === "sep" || embedCtx === "sep";

  return (
    <SessionProvider initialUser={user}>
      {isSep ? (
        <EmbeddedShell>{children}</EmbeddedShell>
      ) : (
        <AppShell>{children}</AppShell>
      )}
      <FloatingNav />
      <MobileFabNav />
    </SessionProvider>
  );
}
