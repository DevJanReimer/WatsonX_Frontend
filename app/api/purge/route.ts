import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
    const res  = await fetch(`${fastApiUrl}/purge`, { method: "POST" });
    const data = await res.json().catch(() => ({ error: "Ungültige Antwort vom Backend" }));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? data?.error ?? "Purge fehlgeschlagen" },
        { status: res.status }
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Purge fehlgeschlagen" }, { status: 500 });
  }
}
