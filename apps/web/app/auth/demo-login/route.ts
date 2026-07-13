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

// Login de demostración para compartir con terceros (p.ej. el equipo de SEP)
// que deban navegar todas las páginas de SISMO sin una cuenta de Google.
//
// SOLO se activa si SISMO_DEMO_LOGIN=1; en cualquier otro caso devuelve 404.
// Debe habilitarse únicamente en una instancia de demostración/staging, nunca
// en una producción con datos reales, ya que cualquiera con la URL entra como
// admin fijo.
//
// El usuario es el sembrado por scripts/seed.py (DEMO_USER_ID).
const DEMO_USER_ID = "22222222-2222-2222-2222-222222222222";

export async function GET(request: Request) {
  if (process.env.SISMO_DEMO_LOGIN !== "1") {
    return new Response("not found", { status: 404 });
  }

  const sessionCookie = encodeSession({
    user_id: DEMO_USER_ID,
    role: "admin",
    status: "active",
  });
  const csrfToken = generateCsrfToken();
  const domain = cookieDomain();
  const { sameSite, secure } = cookieSameSite();

  // 200 + meta-refresh (no 3xx) para que Safari no descarte la cookie de la
  // redirección; igual que en dev-login.
  const cookieFlags = `HttpOnly;${secure ? " Secure;" : ""} SameSite=${
    sameSite === "none" ? "None" : "Lax"
  }; Path=/; Max-Age=${authCookieMaxAgeSeconds}${domain ? `; Domain=${domain}` : ""}`;

  const webOrigin =
    process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001";

  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/voluntarios"></head><body>Redirigiendo a Sismo Voluntarios…</body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  response.headers.append(
    "Set-Cookie",
    `${authCookieName}=${sessionCookie};${cookieFlags}`,
  );
  response.headers.append(
    "Set-Cookie",
    `${csrfCookieName}=${csrfToken};${cookieFlags}`,
  );
  return response;
}
