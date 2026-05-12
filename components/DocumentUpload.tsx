"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface UploadedFile {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

export default function DocumentUpload() {
  const inputRef  = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [files,     setFiles]     = useState<UploadedFile[]>([]);
  const [dragOver,  setDragOver]  = useState(false);
  const [log,       setLog]       = useState<string[]>([]);
  const [progress,  setProgress]  = useState("");
  const [runVision, setRunVision] = useState(false);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const fileArray = Array.from(list);

    // Assign a stable ID to each file now — use this ID (not the name) for all status updates
    const newEntries: UploadedFile[] = fileArray.map(f => ({
      id: uid(),
      name: f.name,
      status: "uploading",
    }));
    const batchIds   = new Set(newEntries.map(e => e.id));
    // Map filename → frontend ID so completed_files can mark individual files done
    const nameToId   = new Map(newEntries.map(e => [e.name, e.id]));

    setFiles(prev => [...prev, ...newEntries]);
    setLog([]);
    setProgress("Hochladen...");

    try {
      const form = new FormData();
      fileArray.forEach(f => form.append("file", f));
      form.append("run_vision", String(runVision));

      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Fehler ${res.status}`);
      }

      const { job_id } = await res.json();
      setProgress("Verarbeitung läuft…");

      // Simple async polling loop — avoids setInterval/Promise interaction issues
      const MAX_POLLS = 300; // 10 min at 2 s intervals
      for (let tick = 1; tick <= MAX_POLLS; tick++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const poll = await fetch(`/api/upload/status/${job_id}?t=${tick}`, { cache: "no-store" });
          if (!poll.ok) {
            setProgress(`Warte auf Backend… (${tick})`);
            continue;
          }
          const job = await poll.json();
          setLog(job.log ?? []);
          setProgress(job.progress ? `${job.progress} (${tick})` : `Verarbeitung läuft… (${tick})`);

          // Mark each completed file individually as soon as the backend reports it
          const completedIds = new Set(
            (job.completed_files ?? [] as string[]).map((n: string) => nameToId.get(n)).filter(Boolean)
          );
          if (completedIds.size > 0) {
            setFiles(prev => prev.map(f =>
              completedIds.has(f.id) ? { ...f, status: "done" } : f
            ));
          }

          if (job.status === "done") {
            // Catch any files not yet marked (e.g. last batch)
            setFiles(prev => prev.map(f =>
              batchIds.has(f.id) ? { ...f, status: "done" } : f
            ));
            setProgress("✓ Alle Dokumente verarbeitet");
            break;
          } else if (job.status === "error") {
            setFiles(prev => prev.map(f =>
              batchIds.has(f.id) && f.status !== "done"
                ? { ...f, status: "error", error: job.error ?? "Fehler" }
                : f
            ));
            setProgress(`Fehler: ${job.error}`);
            break;
          }
        } catch {
          setProgress(`Netzwerkfehler beim Polling (${tick})`);
        }
      }

    } catch (err: any) {
      setFiles(prev => prev.map(f =>
        batchIds.has(f.id) ? { ...f, status: "error", error: err?.message ?? "Fehlgeschlagen" } : f
      ));
      setProgress(`Fehler: ${err?.message}`);
    }
  }

  return (
    <div className="space-y-3">
      {/* Vision toggle */}
      <button
        type="button"
        onClick={() => setRunVision(v => !v)}
        className={clsx(
          "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition w-full justify-between",
          runVision
            ? "bg-abraxas-50 border-abraxas-400 text-abraxas-800"
            : "bg-white border-abraxas-200 text-abraxas-500"
        )}
      >
        <span className="flex items-center gap-1.5">
          {runVision ? <Eye size={13} /> : <EyeOff size={13} />}
          Bildbeschreibung (VLM)
        </span>
        <span className={clsx(
          "text-[10px] font-medium px-1.5 py-0.5 rounded",
          runVision ? "bg-abraxas-500 text-white" : "bg-abraxas-100 text-abraxas-400"
        )}>
          {runVision ? "AN" : "AUS"}
        </span>
      </button>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition",
          dragOver
            ? "border-abraxas-500 bg-abraxas-50"
            : "border-abraxas-200 hover:border-abraxas-400 bg-white"
        )}
      >
        <Paperclip className="mx-auto mb-2 text-abraxas-500" size={22} />
        <div className="text-sm font-medium text-abraxas-800">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            Dateien auswählen
          </button>
        </div>
        <div className="text-xs text-abraxas-500 mt-1">
          PDF, DOCX, DOC · max. 25&nbsp;MB
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory=""
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 text-sm bg-white border border-abraxas-100 rounded-lg px-3 py-2"
            >
              {f.status === "done" ? (
                <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
              ) : f.status === "error" ? (
                <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
              ) : (
                <Loader2 size={14} className="animate-spin text-abraxas-500 flex-shrink-0" />
              )}
              <span className="flex-1 truncate text-abraxas-800">{f.name}</span>
              {f.status === "error" && f.error && (
                <span className="text-xs text-red-600 truncate max-w-[120px]">{f.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {progress && (
        <p className="text-xs text-abraxas-600 mt-2">{progress}</p>
      )}
      {log.length > 0 && (
        <ul className="mt-2 text-xs font-mono bg-gray-50 border border-gray-200
                       rounded-lg p-2 space-y-0.5 max-h-40 overflow-y-auto">
          {log.map((line, i) => (
            <li key={i} className={line.includes("✗") ? "text-red-600" : "text-gray-700"}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
