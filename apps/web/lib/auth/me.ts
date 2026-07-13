import { cookies } from "next/headers";

import { authCookieName } from "@/lib/auth/config";

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  photo_url: string | null;
  google_photo_url: string | null;
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
  auth_source: "google" | "sep";
  referral_code: string;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const cookie = store.get(authCookieName)?.value;
  if (!cookie) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      cache: "no-store",
      headers: { Cookie: `sismo_session=${cookie}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: data.id as string,
      email: data.email as string,
      name: (data.name as string | null) ?? null,
      photo_url: (data.photo_url as string | null) ?? null,
      google_photo_url: (data.google_photo_url as string | null) ?? null,
      role: data.role as "volunteer" | "admin",
      status: data.status as "pending" | "active" | "suspended",
      auth_source: (data.auth_source as "google" | "sep") ?? "google",
      referral_code: data.referral_code as string,
    };
  } catch {
    return null;
  }
}
