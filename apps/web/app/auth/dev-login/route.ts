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

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("not found", { status: 404 });
  }

  const sessionCookie = encodeSession({
    user_id: DEV_USER_ID,
    role: "admin",
    status: "active",
  });
  const csrfToken = generateCsrfToken();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();

  const cookieFlags = `HttpOnly;${secure ? " Secure;" : ""} SameSite=${
    sameSite === "none" ? "None" : "Lax"
  }; Path=/; Max-Age=${authCookieMaxAgeSeconds}${domain ? `; Domain=${domain}` : ""}`;

  const webOrigin =
    process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001";

  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/admin"></head><body>Redirigiendo a Sismo Admin…</body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  response.headers.append("Set-Cookie", `${authCookieName}=${sessionCookie};${cookieFlags}`);
  response.headers.append("Set-Cookie", `${csrfCookieName}=${csrfToken};${cookieFlags}`);
  return response;
}
