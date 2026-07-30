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
  // Bypass para modo desarrollo — permite acceder sin cookie de sesión
  // Para activar: DEV_BYPASS_AUTH=true en .env del contenedor
  // Para desactivar: comentar estas 3 líneas
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return {
      authenticated: true,
      user_id: "dev-user-id",
      role: "admin",
      status: "active",
    };
  }

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
