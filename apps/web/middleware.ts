import { NextResponse, type NextRequest } from "next/server";

// Security headers for every browser-facing HTML response.
//
// NOTE on script-src: Next.js App Router streams RSC payloads through inline
// <script> tags that cannot carry a per-request nonce, so a strict
// `script-src 'nonce-...'` policy would break hydration. We therefore allow
// 'unsafe-inline' scripts but restrict scripts to same-origin and the Google
// OAuth host, which blocks the dangerous vector (remote script injection via
// XSS). Combined with frame-ancestors 'none' and object-src 'none' this
// mitigates clickjacking and script-injection from external origins.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Don't attach browser security headers to API route handlers or Next
  // internals; they are not HTML documents.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isDev = (process.env.NODE_ENV ?? "development") !== "production";

  // frame-ancestors: by default only same-origin framing is allowed
  // (`'self'`). When SEP is configured to embed Sismo, SISMO_FRAME_ANCESTORS
  // lists the allowed SEP parent origins (comma-separated). This is what lets
  // the SEP platform load Sismo inside an <iframe>.
  const ancestors = (process.env.SISMO_FRAME_ANCESTORS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sepEmbedEnabled = ancestors.length > 0;
  const frameAncestors = sepEmbedEnabled
    ? `${ancestors.join(" ")} self`
    : "self";

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is required for Next.js App Router RSC payloads;
    // remote scripts are locked to first-party + Google OAuth + Cloudflare
    // Insights (auto-injected by the Cloudflare Tunnel / Web Analytics).
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://static.cloudflareinsights.com https://cdn.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://static.cloudflareinsights.com https://cdn.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    isDev
      ? "connect-src 'self' http://localhost:* http://127.0.0.1:* https: wss: https://*.cloudflareinsights.com"
      : "connect-src 'self' https: wss: https://*.cloudflareinsights.com",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    // En dev (localhost/http) no se necesita upgrade-insecure-requests;
    // fuerza https y rompe las rutas internas que usan http.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  // X-Frame-Options conflicts with a permissive frame-ancestors; modern
  // browsers honor frame-ancestors, but we omit XFO when SEP embedding is
  // enabled so older engines don't block the iframe. When only same-origin
  // framing is allowed we keep DENY as defense-in-depth.
  if (!sepEmbedEnabled) {
    response.headers.set("X-Frame-Options", "DENY");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
