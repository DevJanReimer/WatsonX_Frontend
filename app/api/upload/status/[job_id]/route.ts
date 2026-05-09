import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { job_id: string } }
) {
  const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${fastApiUrl}/status/${params.job_id}`);
    const data = await res.json().catch(() => ({ error: "Ungültige Antwort vom Backend" }));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Backend nicht erreichbar" }, { status: 502 });
  }
}
