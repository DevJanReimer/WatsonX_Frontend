import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
  try {
    const res  = await fetch(`${fastApiUrl}/status/${params.jobId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend nicht erreichbar" },
      { status: 503 }
    );
  }
}
