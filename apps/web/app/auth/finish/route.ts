import { NextResponse } from "next/server";

import {
  authCookieMaxAgeSeconds,
  authCookieName,
  cookieDomain,
  cookieSameSite,
  csrfCookieName,
  refreshCookieName,
} from "@/lib/auth/config";
import { encodeSession } from "@/lib/auth/cookie";
import { generateCsrfToken } from "@/lib/auth/csrf";

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type ExchangeResponse = {
  user_id: string;
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
  refresh_token: string;
  access_max_age: number;
  refresh_max_age: number;
};

async function exchangeCode(code: string): Promise<ExchangeResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/exchange`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExchangeResponse;
  } catch {
    return null;
  }
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, WEB_ORIGIN));
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_missing_params", WEB_ORIGIN));
  }

  const user = await exchangeCode(code);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=oauth_exchange", WEB_ORIGIN));
  }
  if (user.status === "suspended") {
    return NextResponse.redirect(new URL("/login?error=suspended", WEB_ORIGIN));
  }

  const accessMaxAge = user.access_max_age || authCookieMaxAgeSeconds;
  const refreshMaxAge = user.refresh_max_age || 60 * 60 * 24 * 30;
  const sessionCookie = encodeSession({ user_id: user.user_id, role: user.role, status: user.status }, accessMaxAge);
  const csrfToken = generateCsrfToken();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();

  console.log("[auth/finish] cookie domain:", domain, "sameSite:", sameSite, "secure:", secure);

  const redirectUrl =
    user.role === "admin" ? `${WEB_ORIGIN}/admin` : `${WEB_ORIGIN}/voluntarios`;
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head><body>Redirecting...</body></html>`;
  const headers = new Headers();
  headers.set("Content-Type", "text/html");
  headers.append(
    "Set-Cookie",
    `${authCookieName}=${sessionCookie}; HttpOnly; Secure; SameSite=${sameSite === "none" ? "None" : "Lax"}; Path=/; Max-Age=${accessMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  headers.append(
    "Set-Cookie",
    `${csrfCookieName}=${csrfToken}; Secure; SameSite=${sameSite === "none" ? "None" : "Lax"}; Path=/; Max-Age=${accessMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  // Revocable, rotating refresh token (HttpOnly). The API stores its id in
  // Redis; the web only ever holds the opaque value in this cookie.
  headers.append(
    "Set-Cookie",
    `${refreshCookieName}=${user.refresh_token}; HttpOnly; Secure; SameSite=${sameSite === "none" ? "None" : "Lax"}; Path=/; Max-Age=${refreshMaxAge}${domain ? `; Domain=${domain}` : ""}`,
  );
  return new Response(html, { status: 200, headers });
}
