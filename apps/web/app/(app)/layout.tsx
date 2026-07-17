import { fetchCurrentUser } from "@/lib/auth/me";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";
import { ExternalShell } from "@/components/external-shell";
import { TourProvider } from "@/components/onboarding/onboarding-tour";
import { getSepNavigation } from "@/lib/sep-nav";

// Chrome is chosen by the user's account type:
//   - SEP users (auth_source "sep"): SISMO renders its own header + sidebar that
//     imitate the SEP site (AppShell). SISMO is served as one more page under
//     the SEP domain (reverse proxy / container), never inside an <iframe>.
//     The sidebar's SEP navigation is fetched live from SEP (see lib/sep-nav).
//   - External users (Google/OAuth): no SEP-like sidebar; they navigate with the
//     floating panel / FAB (ExternalShell). See docs/external-users-access.md.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await fetchCurrentUser();
  const isSep = user?.auth_source === "sep";

  // Fetched once per render of the app shell. Cheap (cached by SEP) and
  // fails open to an empty list if SEP is unreachable.
  const sepNav = isSep ? await getSepNavigation() : [];

  return (
    <SessionProvider initialUser={user}>
      <TourProvider>
        {isSep ? (
          <AppShell sepNav={sepNav}>{children}</AppShell>
        ) : (
          <ExternalShell>{children}</ExternalShell>
        )}
      </TourProvider>
    </SessionProvider>
  );
}
