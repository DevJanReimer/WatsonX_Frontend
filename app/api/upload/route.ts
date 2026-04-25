import { NextRequest, NextResponse } from "next/server";
import { orchestrateUpload } from "@/lib/orchestrate";
import { saveDocuments, DocumentRecord } from "@/lib/astra";

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

async function processFile(file: File): Promise<{ filename: string; ok: boolean; error?: string; body?: unknown }> {
  console.log(`[upload] processing file: ${file.name} (${file.size} bytes, ${file.type})`);

  if (file.size === 0) {
    console.warn(`[upload] rejected ${file.name}: empty file`);
    return { filename: file.name, ok: false, error: "Empty file." };
  }
  if (file.size > MAX_SIZE) {
    console.warn(`[upload] rejected ${file.name}: exceeds size limit (${file.size} bytes)`);
    return { filename: file.name, ok: false, error: `File exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB limit.` };
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    console.warn(`[upload] rejected ${file.name}: unsupported type ${file.type}`);
    return { filename: file.name, ok: false, error: `Unsupported type: ${file.type}` };
  }

  console.log(`[upload] sending ${file.name} to watsonx Orchestrate`);
  const { status, body } = await orchestrateUpload(file);
  console.log(`[upload] watsonx response for ${file.name}: status=${status}`, JSON.stringify(body));

  return { filename: file.name, ok: status >= 200 && status < 300, body };
}

export async function POST(req: NextRequest) {
  console.log("[upload] POST /api/upload called");
  try {
    const form = await req.formData();
    const entries = form.getAll("file");
    const files = entries.filter((e): e is File => e instanceof File);
    console.log(`[upload] received ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`);

    if (files.length === 0) {
      console.warn("[upload] no files found in form data");
      return NextResponse.json({ error: "Expected at least one 'file' field." }, { status: 400 });
    }

    const results = await Promise.all(files.map(processFile));
    console.log(`[upload] watsonx results: ${results.filter((r) => r.ok).length}/${results.length} succeeded`);

    // Batch-save successful uploads to AstraDB (with file content)
    const successfulFiles = results.filter((r) => r.ok);
    if (successfulFiles.length > 0) {
      console.log(`[upload] preparing ${successfulFiles.length} record(s) for AstraDB`);
      const records: DocumentRecord[] = await Promise.all(
        successfulFiles.map(async (r) => {
          const file = files.find((f) => f.name === r.filename)!;
          const bytes = await file.arrayBuffer();
          const content = Buffer.from(bytes).toString("base64");
          console.log(`[upload] base64 encoded ${file.name}: ${content.length} chars`);
          return {
            filename: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
            content,
            watsonxDocumentId: (r.body as any)?.id ?? null
          };
        })
      );

      // Fire-and-forget — don't block the response on AstraDB latency
      saveDocuments(records).catch((dbErr: any) =>
        console.error("[upload] AstraDB save failed:", dbErr?.message)
      );
    }

    if (files.length === 1) {
      const r = results[0];
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json(r.body, { status: 200 });
    }

    return NextResponse.json({ results }, { status: 207 });
  } catch (err: any) {
    console.error("[upload] unhandled error:", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message ?? "Upload failed" }, { status: 500 });
  }
}
