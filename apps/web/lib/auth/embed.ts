import { headers, cookies } from "next/headers";

export type EmbedContext = "external" | "sep";

export type EmbedSearchParams = Record<string, string | string[] | undefined>;

/**
 * Determines whether the app is rendered standalone (external users that see
 * the full Sismo chrome) or embedded inside the SEP platform (which supplies
 * its own top bar and side bar, so our navigation must be self-contained).
 *
 * Detection priority:
 *   1. `embed=1` (or `context=sep`) query param — used when SEP loads Sismo
 *      inside a cross-site <iframe>, where cookies/headers can't be set by SEP.
 *   2. SEP_EMBED env (local/dev override)
 *   3. `x-sismo-context: sep` request header (injected by the SEP proxy)
 *   4. `sismo_ctx=sep` cookie (alternative proxy signal)
 */
export async function getEmbedContext(
  searchParams?: EmbedSearchParams,
): Promise<EmbedContext> {
  const embedParam =
    typeof searchParams?.embed === "string" ? searchParams.embed : undefined;
  const contextParam =
    typeof searchParams?.context === "string" ? searchParams.context : undefined;
  if (embedParam === "1" || contextParam === "sep") return "sep";

  if (process.env.SEP_EMBED === "1") return "sep";

  const h = await headers();
  if (h.get("x-sismo-context") === "sep") return "sep";

  const store = await cookies();
  if (store.get("sismo_ctx")?.value === "sep") return "sep";

  return "external";
}
