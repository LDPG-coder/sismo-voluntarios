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
        if (ok) {
          const me = await fetchMeClient();
          if (me && active) setUser(me);
        }
      }
    }
    void bootstrap();

    // Keep the short-lived access token fresh while the tab is open.
    const interval = setInterval(() => void refreshSession(), 20 * 60 * 1000);

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
