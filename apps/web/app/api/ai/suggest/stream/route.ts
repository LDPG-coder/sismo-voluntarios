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
    const res = await fetch(`${API_BASE}/api/v1/ai/suggest/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        "X-CSRF-Token": xsrf,
      },
      body,
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: { code: "no_stream", message: "No stream" } }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // stream ended
        } finally {
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: "proxy_error", message: "Error connecting to API" } },
      { status: 502 },
    );
  }
}
