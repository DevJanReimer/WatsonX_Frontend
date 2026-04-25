"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import clsx from "clsx";

interface UploadedFile {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

export default function DocumentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  async function uploadOne(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload fehlgeschlagen (${res.status})`);
      }
      setFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: "done" } : f)
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: "error", error: err?.message ?? "Fehlgeschlagen" }
            : f
        )
      );
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const fileArray = Array.from(list);
    // Mark all as uploading immediately, then upload in parallel
    setFiles((prev) => [
      ...prev,
      ...fileArray.map((f) => ({ name: f.name, status: "uploading" as const }))
    ]);
    await Promise.all(fileArray.map(uploadOne));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition",
          dragOver
            ? "border-abraxas-500 bg-abraxas-50"
            : "border-abraxas-200 hover:border-abraxas-400 bg-white"
        )}
      >
        <Paperclip
          className="mx-auto mb-2 text-abraxas-500"
          size={22}
        />
        <div className="text-sm font-medium text-abraxas-800">
          Dateien hierher ziehen oder auswählen
        </div>
        <div className="text-xs text-abraxas-500 mt-1">
          PDF, DOCX, XLSX, PPTX, TXT · max. 25&nbsp;MB
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 text-sm bg-white border border-abraxas-100 rounded-lg px-3 py-2"
            >
              {f.status === "uploading" && (
                <Loader2
                  size={14}
                  className="animate-spin text-abraxas-500 flex-shrink-0"
                />
              )}
              {f.status === "done" && (
                <CheckCircle2
                  size={14}
                  className="text-emerald-600 flex-shrink-0"
                />
              )}
              {f.status === "error" && (
                <AlertCircle
                  size={14}
                  className="text-red-600 flex-shrink-0"
                />
              )}
              <span className="flex-1 truncate text-abraxas-800">
                {f.name}
              </span>
              {f.status === "error" && f.error && (
                <span className="text-xs text-red-600">{f.error}</span>
              )}
              <button
                type="button"
                onClick={() =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-abraxas-400 hover:text-abraxas-700"
                aria-label="Entfernen"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
