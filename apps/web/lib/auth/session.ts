import { cookies } from "next/headers";

import { authCookieName } from "./config";
import { decodeSession } from "./cookie";
import type { UserRole, UserStatus } from "./role";

export type { UserRole, UserStatus };

export type UserSession =
  | {
      authenticated: true;
      user_id: string;
      role: UserRole;
      status: UserStatus;
    }
  | { authenticated: false; reason: string };

export async function readUserSession(): Promise<UserSession> {
  const store = await cookies();
  const raw = store.get(authCookieName)?.value;
  const result = decodeSession(raw);
  if (!result.ok) {
    return { authenticated: false, reason: result.reason };
  }
  return {
    authenticated: true,
    user_id: result.payload.user_id,
    role: result.payload.role,
    status: result.payload.status,
  };
}
