"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { fetchMeClient, refreshSession } from "@/lib/auth/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  photo_url: string | null;
  google_photo_url: string | null;
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
  auth_source: "google" | "sep";
  referral_code: string;
} | null;

type SessionContextValue = {
  user: SessionUser;
  setUser: React.Dispatch<React.SetStateAction<SessionUser>>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "sismo_session_user";

// SEP origin: in the SEP-integrated deployment the sismo web is served under
// the SEP domain and NEXT_PUBLIC_WEB_ORIGIN points at the SEP itself. The SEP
// /api/sismo/sso endpoint mints a session for an already-signed-in SEP user.
const SEP_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || "http://localhost:3000";

function redirectToSepSso(): void {
  window.location.href = `${SEP_ORIGIN}/api/sismo/sso`;
}

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SessionUser>(initialUser);

  useEffect(() => {
    let active = true;

    // Recover from a cold start: if the server-rendered cookie had already
    // expired (or no user was resolved), refresh tokens and reload the user
    // client-side. This avoids a hard redirect to login on every page load
    // once the short access token lapses.
    async function bootstrap() {
      if (!user) {
        const ok = await refreshSession();
        if (!ok) {
          // Refresh died or was revoked: the SEP session is gone too, so send
          // the user back through the SEP SSO instead of leaving a broken page.
          redirectToSepSso();
          return;
        }
        const me = await fetchMeClient();
        if (me && active) setUser(me);
      }
    }
    void bootstrap();

    // Keep the short-lived access token fresh while the tab is open. If the
    // refresh stops working mid-session, re-authenticate through the SEP SSO.
    const interval = setInterval(async () => {
      const ok = await refreshSession();
      if (!ok) redirectToSepSso();
    }, 20 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore unavailable storage
    }
  }, [user]);

  return (
    <SessionContext.Provider value={{ user, setUser }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
