// Server-side consumer of the SEP navigation menu.
//
// SISMO's sidebar mirrors the SEP site's navigation. Instead of hard-coding
// (and constantly drifting from) SEP's structure, SISMO fetches the menu from
// a JSON endpoint that SEP exposes. SEP owns the list; SISMO only renders it.
// SEP filters by access tier using the user's email.

export type SepNavSubItem = {
  label: string;
  href: string;
};

export type SepNavGroup = {
  label: string;
  href: string | null;
  items?: SepNavSubItem[];
};

export type SepNavSection = {
  section: string;
  items: SepNavGroup[];
};

export type SepNavResponse = {
  sections: SepNavSection[];
};

const NAV_URL = process.env.SEP_NAVIGATION_URL?.trim() || "";
const PARTNER_TOKEN = process.env.SISMO_SEP_PARTNER_TOKEN?.trim() || "";
const TIMEOUT_MS = 2500;

/**
 * Fetch the SEP navigation tree. The user's email is passed so SEP can filter
 * by access tier, and the shared partner token is sent so SEP's endpoint can
 * authenticate this server-to-server call. Returns an empty sections list when
 * unconfigured or on any failure (network error, timeout, bad shape) so the
 * SISMO sidebar always renders — SEP's navigation is an enhancement, never a
 * hard dependency.
 */
export async function getSepNavigation(
  email?: string | null,
): Promise<SepNavResponse> {
  if (!NAV_URL) return { sections: [] };

  const url = new URL(NAV_URL);
  if (email) url.searchParams.set("email", email);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(PARTNER_TOKEN ? { "x-sep-partner-token": PARTNER_TOKEN } : {}),
      },
    });
    if (!res.ok) return { sections: [] };
    const data = (await res.json()) as SepNavResponse;
    if (!Array.isArray(data.sections)) return { sections: [] };
    return { sections: data.sections };
  } catch {
    return { sections: [] };
  } finally {
    clearTimeout(timer);
  }
}
