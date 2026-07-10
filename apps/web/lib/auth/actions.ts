"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  authCookieMaxAgeSeconds,
  authCookieName,
  cookieDomain,
  cookieSameSite,
  csrfCookieName,
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

export async function finishOAuthAction(code: string): Promise<void> {
  const user = await exchangeCode(code);
  if (!user) {
    redirect("/login?error=oauth_exchange");
  }
  if (user.status === "suspended") {
    redirect("/login?error=suspended");
  }

  const cookieStore = await cookies();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();
  cookieStore.set({
    name: authCookieName,
    value: encodeSession({ user_id: user.user_id, role: user.role, status: user.status }),
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: authCookieMaxAgeSeconds,
    ...(domain ? { domain } : {}),
  });
  cookieStore.set({
    name: csrfCookieName,
    value: generateCsrfToken(),
    httpOnly: false,
    secure,
    sameSite,
    path: "/",
    maxAge: authCookieMaxAgeSeconds,
    ...(domain ? { domain } : {}),
  });
  redirect("/voluntarios");
}
