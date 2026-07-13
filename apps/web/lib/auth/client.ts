"use client";

/**
 * Client-side session helpers. These run in the browser where Set-Cookie from
 * the web `/auth/refresh` route is honoured, so they are the right place to
 * rotate the short-lived access token and recover from a cold start where the
 * server-rendered session cookie has already expired.
 */

import type { SessionUser } from "@/components/session-provider";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Rotate the access + refresh tokens via the web refresh route. */
export async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch("/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch the current user from the API using the (refreshed) session cookie. */
export async function fetchMeClient(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    return {
      id: d.id as string,
      email: d.email as string,
      name: (d.name as string | null) ?? null,
      photo_url: (d.photo_url as string | null) ?? null,
      google_photo_url: (d.google_photo_url as string | null) ?? null,
      role: d.role as "volunteer" | "admin",
      status: d.status as "pending" | "active" | "suspended",
      auth_source: (d.auth_source as "google" | "sep") ?? "google",
      referral_code: d.referral_code as string,
    };
  } catch {
    return null;
  }
}
