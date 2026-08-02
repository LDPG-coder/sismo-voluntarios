import { fetchCurrentUser } from "@/lib/auth/me";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";
import { ScholarShell } from "@/components/scholar-shell";
import { ExternalShell } from "@/components/external-shell";
import { TourProvider } from "@/components/onboarding/onboarding-tour";
import { getSepNavigation } from "@/lib/sep-nav";

// Chrome is chosen by the user's account type:
//   - SEP admins (auth_source "sep", role "admin"): green SEP-like shell
//     (AppShell). SISMO is served as one more page under the SEP domain
//     (reverse proxy / container), never inside an <iframe>.
//   - SEP volunteers/scholars (auth_source "sep", role "volunteer"): white
//     scholar shell (ScholarShell) mirroring SEP's scholar sidebar.
//   - External users (Google/OAuth): no SEP-like sidebar; they navigate with the
//     floating panel / FAB (ExternalShell). See docs/external-users-access.md.
// The sidebar's SEP navigation is fetched live from SEP (see lib/sep-nav).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await fetchCurrentUser();
  const isSep = user?.auth_source === "sep";
  const isSepAdmin = isSep && user?.role === "admin";

  // Fetched once per render of the app shell. SEP filters by access tier
  // using the user's email. Fails open to empty if SEP is unreachable.
  const sepNav = isSep ? await getSepNavigation(user?.email) : { sections: [] };

  return (
    <SessionProvider initialUser={user}>
      <TourProvider>
        {isSepAdmin ? (
          <AppShell sepNav={sepNav}>{children}</AppShell>
        ) : isSep ? (
          <ScholarShell sepNav={sepNav}>{children}</ScholarShell>
        ) : (
          <ExternalShell>{children}</ExternalShell>
        )}
      </TourProvider>
    </SessionProvider>
  );
}
