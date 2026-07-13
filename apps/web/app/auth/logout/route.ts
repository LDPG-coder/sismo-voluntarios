import { NextResponse } from "next/server";
import { authCookieName, cookieDomain, refreshCookieName } from "@/lib/auth/config";

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith("XSRF-TOKEN="));
    const xsrf = match ? match.slice("XSRF-TOKEN=".length) : "";
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: xsrf ? { cookie, "X-CSRF-Token": xsrf } : { cookie },
    });
  } catch {
    // silent
  }

  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001"));
  const domain = cookieDomain();
  const opts = { path: "/", maxAge: 0, ...(domain ? { domain } : {}) };
  response.cookies.set(authCookieName, "", opts);
  response.cookies.set("XSRF-TOKEN", "", opts);
  response.cookies.set(refreshCookieName, "", opts);
  return response;
}
