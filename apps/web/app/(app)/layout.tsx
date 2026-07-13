import { fetchCurrentUser } from "@/lib/auth/me";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";
import { FloatingNav } from "@/components/floating-nav";
import { MobileFabNav } from "@/components/mobile-fab-nav";

// TODO(prueba): simular "dentro de SEP" mostrando la chrome normal
// (top/side bar) Y la navegacion flotante del modulo a la vez.
// Revertir: elegir AppShell | EmbeddedShell segun getEmbedContext().
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await fetchCurrentUser();
  return (
    <SessionProvider initialUser={user}>
      <AppShell>{children}</AppShell>
      <FloatingNav />
      <MobileFabNav />
    </SessionProvider>
  );
}
