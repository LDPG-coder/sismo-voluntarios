/**
 * Client-side CSRF helpers.
 *
 * The web reads the XSRF-TOKEN cookie (which the login
 * Server Action set non-HTTP-only) and adds the same value
 * in the X-CSRF-Token header on every write. The FastAPI
 * middleware checks the double-submit.
 *
 * `getCsrfToken()` returns null on the server (the cookie
 * is not visible there in SSR; the API's C3 check via
 * /api/v1/auth/me is the only place the web reads from
 * the server) and the value on the client. The fetch
 * wrapper in `lib/api/managers.ts` calls this on every
 * non-GET request.
 *
 * `csrfHeaders()` returns the headers object to spread
 * into a fetch — empty on reads, `{X-CSRF-Token: token}`
 * on writes.
 */

import { csrfCookieName } from "./config";

export const CSRF_HEADER_NAME = "X-CSRF-Token";

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${csrfCookieName}=`));
  if (!match) {
    return null;
  }
  return match.slice(csrfCookieName.length + 1) || null;
}

export function csrfHeaders(method: string): Record<string, string> {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return {};
  }
  const token = getCsrfToken();
  if (!token) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
}
