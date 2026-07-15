// Server-side consumer of the SEP navigation menu.
//
// SISMO's sidebar must mirror the SEP site's navigation. Instead of hard-coding
// (and constantly drifting from) SEP's structure, SISMO fetches the menu from a
// JSON endpoint that the SEP platform exposes. SEP owns the list; SISMO only
// renders it. See docs/SEP_INTEGRATION.md §2.2 for the contract.

export type SepNavItem = {
  label: string;
  href: string;
  requiresSession?: boolean;
};

type SepNavPayload = {
  items?: SepNavItem[];
};

const NAV_URL = process.env.SEP_NAVIGATION_URL?.trim() || "";
const TIMEOUT_MS = 2500;

/**
 * Fetch the SEP navigation items. Returns an empty list when unconfigured or on
 * any failure (network error, timeout, bad shape) so the SISMO sidebar always
 * renders — SEP's navigation is an enhancement, never a hard dependency.
 */
export async function getSepNavigation(): Promise<SepNavItem[]> {
  if (!NAV_URL) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(NAV_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SepNavPayload;
    if (!Array.isArray(data.items)) return [];
    return data.items.filter(
      (it): it is SepNavItem =>
        !!it && typeof it.label === "string" && typeof it.href === "string",
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
