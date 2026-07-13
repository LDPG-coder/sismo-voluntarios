/**
 * Server-side auth configuration.
 *
 * Phase 2 stopgap: the only credential is the shared
 * `SISMO_IMPORTER_TOKEN` (same one the API uses). We sign
 * the session cookie with a separate secret so the cookie
 * itself is tamper-evident even if the token leaks through
 * a different channel.
 *
 * The split matters: if the cookie were just the token, a
 * stolen `X-Importer-Token` header would also be a valid
 * cookie. With a separate signing secret, the API token
 * never has to live in the cookie payload.
 *
 * The cookie is also wrapped in HMAC: a valid token without
 * the signature is rejected. The format is `<token>.<hmac>`.
 *
 * Production guard: if `NODE_ENV === "production"` and
 * `SISMO_SESSION_SECRET` is not set, this module raises at
 * import time. The dev default value is a footgun: an
 * operator who forgets the env var in prod would otherwise
 * sign every cookie with a known string. The crash is loud
 * and immediate.
 */

const IMPORTER_TOKEN_ENV = "SISMO_IMPORTER_TOKEN";
const SESSION_SECRET_ENV = "SISMO_SESSION_SECRET";

const DEV_SESSION_SECRET = "dev-only-session-secret-do-not-use-in-production";

const COOKIE_NAME = "sismo_session";
const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const REFRESH_COOKIE_NAME = "sismo_refresh";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function importerToken(): string | undefined {
  return readEnv(IMPORTER_TOKEN_ENV);
}

export function sessionSecret(): string {
  const secret = readEnv(SESSION_SECRET_ENV);
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SISMO_SESSION_SECRET is required in production. " +
        "Generate one with `openssl rand -hex 32` and set it in the secret manager.",
    );
  }
  return DEV_SESSION_SECRET;
}

export function isSessionSecretConfigured(): boolean {
  return readEnv(SESSION_SECRET_ENV) !== undefined;
}

export const authCookieName = COOKIE_NAME;
export const csrfCookieName = CSRF_COOKIE_NAME;
export const refreshCookieName = REFRESH_COOKIE_NAME;
export const authCookieMaxAgeSeconds = COOKIE_MAX_AGE_SECONDS;

/**
 * Cookie domain for cross-subdomain sharing.
 *
 * In production, the web lives at `sismo.lat` and the API at
 * `api.sismo.lat`. The session cookie must be set with
 * `domain=.sismo.lat` so the browser sends it to both subdomains.
 * In dev (localhost), no domain override is needed.
 */
export function cookieDomain(): string | undefined {
  const origin = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "";
  if (!origin || origin.includes("localhost")) return undefined;
  try {
    const url = new URL(origin);
    const parts = url.hostname.split(".");
    if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * SameSite + Secure for cross-subdomain cookies.
 *
 * When the web (sismo.lat) and API (api.sismo.lat) are on
 * different subdomains, the browser treats them as cross-origin.
 * `SameSite=Strict` blocks the cookie entirely on these requests.
 * `SameSite=None` allows it but requires `Secure` (HTTPS).
 *
 * In dev (localhost), we use `Lax` + no Secure since everything
 * is same-origin.
 */
export function cookieSameSite(): { sameSite: "lax" | "none"; secure: boolean } {
  const origin = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "";
  if (!origin || origin.includes("localhost")) {
    return { sameSite: "lax", secure: false };
  }
  return { sameSite: "none", secure: true };
}
