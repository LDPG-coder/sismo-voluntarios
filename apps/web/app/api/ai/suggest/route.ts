import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const xsrf = getCookie(cookie, "XSRF-TOKEN") ?? "";
  const session = getCookie(cookie, "sismo_session");
  const body = await request.text();

  console.log("[api/ai/suggest] has_session:", !!session, "has_xsrf:", !!xsrf, "cookie_len:", cookie.length);

  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        "X-CSRF-Token": xsrf,
      },
      body,
    });

    const data = await res.json();
    console.log("[api/ai/suggest] api_status:", res.status);
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.log("[api/ai/suggest] proxy_error:", e?.message);
    return NextResponse.json(
      { error: { code: "proxy_error", message: "Error connecting to API" } },
      { status: 502 },
    );
  }
}
