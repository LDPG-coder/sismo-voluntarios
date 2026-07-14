import { NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const xsrf = getCookie(cookie, "XSRF-TOKEN") ?? "";
  const body = await request.text();

  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/format-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        "X-CSRF-Token": xsrf,
      },
      body,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.log("[api/ai/format-text] proxy_error:", e?.message);
    return NextResponse.json(
      { error: { code: "proxy_error", message: "Error connecting to API" } },
      { status: 502 },
    );
  }
}
