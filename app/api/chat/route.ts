import { NextRequest, NextResponse } from "next/server";
import { orchestrateChat, type ChatMessage } from "@/lib/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages[] is required" },
        { status: 400 }
      );
    }

    const upstream = await orchestrateChat({ messages, stream: true });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Orchestrate request failed",
          status: upstream.status,
          detail
        },
        { status: 502 }
      );
    }

    // Stream SSE straight through to the browser.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Chat request failed" },
      { status: 500 }
    );
  }
}
