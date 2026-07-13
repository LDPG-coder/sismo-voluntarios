import { NextRequest, NextResponse } from "next/server";

import {
  authCookieName,
  cookieDomain,
  cookieSameSite,
  csrfCookieName,
  refreshCookieName,
} from "@/lib/auth/config";
import { encodeSession } from "@/lib/auth/cookie";
import { generateCsrfToken } from "@/lib/auth/csrf";

/**
 * Proxies a refresh request to the API and sets the resulting tokens as
 * cookies on the web's domain. The API cannot set cookies on the web domain
 * (different origin/subdomain), so the web performs the cookie-setting step.
 *
 * Auth is the HttpOnly refresh cookie the browser sends here; no CSRF token
 * is required because a CSRF attacker cannot read the rotated tokens.
 */

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type RefreshResponse = {
  user_id: string;
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
  refresh_token: string;
  access_max_age: number;
  refresh_max_age: number;
};

export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(refreshCookieName)?.value;
  if (!refresh) {
    return NextResponse.json({ error: { code: "auth.unauthenticated", message: "no refresh token" } }, { status: 401 });
  }

  let data: RefreshResponse;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: { code: "auth.unauthenticated", message: "refresh failed" } }, { status: 401 });
    }
    data = (await res.json()) as RefreshResponse;
  } catch {
    return NextResponse.json({ error: { code: "internal.unexpected", message: "refresh error" } }, { status: 503 });
  }

  const sessionCookie = encodeSession(
    { user_id: data.user_id, role: data.role, status: data.status },
    data.access_max_age,
  );
  const csrfToken = generateCsrfToken();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();
  const accessMaxAge = data.access_max_age || 60 * 60 * 8;
  const refreshMaxAge = data.refresh_max_age || 60 * 60 * 24 * 30;

  const headers = new Headers();
  const sameSiteVal = sameSite === "none" ? "None" : "Lax";
  headers.append(
    "Set-Cookie",
    `${authCookieName}=${sessionCookie}; HttpOnly;${secure ? " Secure;" : ""} SameSite=${sameSiteVal}; Path=/; Max-Age=${accessMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  headers.append(
    "Set-Cookie",
    `${csrfCookieName}=${csrfToken};${secure ? " Secure;" : ""} SameSite=${sameSiteVal}; Path=/; Max-Age=${accessMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  headers.append(
    "Set-Cookie",
    `${refreshCookieName}=${data.refresh_token}; HttpOnly;${secure ? " Secure;" : ""} SameSite=${sameSiteVal}; Path=/; Max-Age=${refreshMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  return new NextResponse(null, { status: 204, headers });
}
