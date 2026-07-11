import { fetchCurrentUser } from "@/lib/auth/me";
import { AppShell } from "@/components/app-shell";
import { SessionProvider } from "@/components/session-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await fetchCurrentUser();
  return (
    <SessionProvider initialUser={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
