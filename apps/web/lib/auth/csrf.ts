/**
 * CSRF token helpers.
 *
 * The double-submit cookie pattern (E2 in the planning
 * doc): the server mints a random token at login, sets
 * it in a non-HTTP-only cookie (`XSRF-TOKEN`), and the
 * client JS reads that cookie and echoes the same value
 * in an `X-CSRF-Token` request header on every write.
 *
 * The FastAPI middleware compares the two: a write is
 * accepted only if the header value equals the cookie
 * value. An attacker who tricks a victim's browser into
 * making a write cannot read the cookie value (cross-
 * origin restrictions on document.cookie), so they
 * cannot forge the header.
 *
 * Reads (GET, HEAD, OPTIONS) are exempt. The CSRF cookie
 * is set by the login Server Action (not exposed to the
 * network as a header); the API's middleware enforces the
 * double-submit.
 *
 * The token is 32 random bytes, base64url-encoded. The
 * web and the API share the format: the web generates
 * the value with `crypto.randomBytes(32)`, the API
 * compares the cookie value to the header value with
 * `secrets.compare_digest` (constant-time).
 *
 * The web's `request()` in `lib/api/managers.ts` reads
 * the token via `getCsrfToken()` and adds the header on
 * every non-GET call. Server Actions are exempt (Next.js
 * checks the Origin header instead — same protection,
 * different surface).
 */

import { randomBytes } from "node:crypto";

export const CSRF_HEADER_NAME = "X-CSRF-Token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}
