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
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
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
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
}
