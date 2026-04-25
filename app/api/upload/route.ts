import { NextRequest, NextResponse } from "next/server";
import { orchestrateUpload } from "@/lib/orchestrate";
import { saveDocument } from "@/lib/astra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
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
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Expected multipart form field 'file'." },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File exceeds ${Math.round(MAX_SIZE / 1024 / 1024)} MB limit.` },
        { status: 413 }
      );
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported content type: ${file.type}. Allowed: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV.`
        },
        { status: 415 }
      );
    }

    const { status, body } = await orchestrateUpload(file);

    if (status >= 200 && status < 300) {
      await saveDocument({
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        watsonxDocumentId: (body as any)?.id ?? null
      });
    }

    return NextResponse.json(body, { status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
