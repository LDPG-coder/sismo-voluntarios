import { headers, cookies } from "next/headers";

export type EmbedContext = "external" | "sep";

/**
 * Determines whether the app is rendered standalone (external users that see
 * the full Sismo chrome) or embedded inside the SEP platform (which supplies
 * its own top bar and side bar, so our navigation must be self-contained).
 *
 * Detection priority:
 *   1. SEP_EMBED env (local/dev override)
 *   2. `x-sismo-context: sep` request header (injected by the SEP proxy)
 *   3. `sismo_ctx=sep` cookie (alternative proxy signal)
 */
export async function getEmbedContext(): Promise<EmbedContext> {
  if (process.env.SEP_EMBED === "1") return "sep";

  const h = await headers();
  if (h.get("x-sismo-context") === "sep") return "sep";

  const store = await cookies();
  if (store.get("sismo_ctx")?.value === "sep") return "sep";

  return "external";
}
