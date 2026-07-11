"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  photo_url: string | null;
  google_photo_url: string | null;
  role: "volunteer" | "admin";
  status: "pending" | "active" | "suspended";
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
