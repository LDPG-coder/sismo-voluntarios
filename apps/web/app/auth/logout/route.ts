import { NextResponse } from "next/server";
import { authCookieName, cookieDomain } from "@/lib/auth/config";

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST" });
  } catch {
    // silent
  }

  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001"));
  const domain = cookieDomain();
  response.cookies.set(authCookieName, "", {
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
  response.cookies.set("XSRF-TOKEN", "", {
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
  return response;
}
