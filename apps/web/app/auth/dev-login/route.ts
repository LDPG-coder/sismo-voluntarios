import { NextResponse } from "next/server";

import {
  authCookieMaxAgeSeconds,
  authCookieName,
  cookieDomain,
  cookieSameSite,
  csrfCookieName,
} from "@/lib/auth/config";
import { encodeSession } from "@/lib/auth/cookie";
import { generateCsrfToken } from "@/lib/auth/csrf";

// Ruta de bypass de login SOLO para desarrollo local.
// Permite entrar como admin fijo sin pasar por Google OAuth.
// Nunca se compila/activa en producción.
//
// Nota: devolvemos un 200 con la cookie y hacemos el salto a /voluntarios
// vía meta-refresh en vez de un 307. Safari descarta cookies seteadas en
// respuestas 3xx de redirección, así que el 200 garantiza que la cookie
// persista antes de la navegación.
const DEV_USER_ID = "11111111-1111-1111-1111-111111111111";

const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const cedula = url.searchParams.get("cedula");

  let userId = DEV_USER_ID;
  let role: "admin" | "volunteer" = "admin";
  let authSource: "sep" | "google" = "sep";
  let displayName = "Dev Admin";

  if (cedula) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/dev-user?cedula=${cedula}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const found = await res.json();
        if (found && found.id) {
          userId = found.id;
          role = found.role === "admin" ? "admin" : "volunteer";
          authSource = found.auth_source === "sep" ? "sep" : "google";
          displayName = found.name || displayName;
        }
      }
    } catch {
      // fallback to dev user
    }
  }

  const sessionCookie = encodeSession({
    user_id: userId,
    role,
    status: "active",
  });
  const csrfToken = generateCsrfToken();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();

  const commonFlags = `${secure ? " Secure;" : ""} SameSite=${
    sameSite === "none" ? "None" : "Lax"
  }; Path=/; Max-Age=${authCookieMaxAgeSeconds}${domain ? `; Domain=${domain}` : ""}`;

  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/voluntarios"></head><body>Redirigiendo a Voluntarios…</body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  response.headers.append("Set-Cookie", `${authCookieName}=${sessionCookie};HttpOnly;${commonFlags}`);
  response.headers.append("Set-Cookie", `${csrfCookieName}=${csrfToken};${commonFlags}`);
  return response;
}
