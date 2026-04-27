import { NextRequest, NextResponse } from "next/server";
import { saveDocuments } from "@/lib/astra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv"
];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const entries = form.getAll("file");
    const files = entries.filter((e): e is File => e instanceof File);

    if (files.length === 0)
      return NextResponse.json({ error: "Keine Datei gefunden." }, { status: 400 });

    for (const file of files) {
      if (file.size === 0)
        return NextResponse.json({ error: `${file.name}: Leere Datei.` }, { status: 400 });
      if (file.size > MAX_SIZE)
        return NextResponse.json({ error: `${file.name}: Datei überschreitet 25 MB Limit.` }, { status: 400 });
      if (file.type && !ALLOWED.includes(file.type))
        return NextResponse.json({ error: `${file.name}: Nicht unterstützter Dateityp.` }, { status: 400 });

      const bytes = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      await saveDocuments(file.name, file.type || "application/octet-stream", text);
    }

    return NextResponse.json({ ok: true, count: files.length }, { status: 200 });
  } catch (err: any) {
    console.error("[upload] error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Upload fehlgeschlagen" }, { status: 500 });
  }
}
