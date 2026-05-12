"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";

export default function PurgeButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<string | null>(null);

  async function handlePurge() {
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/purge", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(`Fehler: ${data?.error ?? res.status}`);
      } else {
        const names: string[] = data.dropped ?? [];
        setResult(
          names.length > 0
            ? `✓ Gelöscht: ${names.join(", ")}`
            : "Keine Collections gefunden."
        );
      }
    } catch (err: any) {
      setResult(`Fehler: ${err?.message}`);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setResult(null); setShowConfirm(true); }}
        className="flex items-center gap-2 w-full justify-center text-sm font-medium
                   text-red-600 border border-red-300 bg-red-50 hover:bg-red-100
                   rounded-lg px-3 py-2 transition"
      >
        <Trash2 size={14} />
        Wissensdatenbank leeren
      </button>

      {result && (
        <p className={`text-xs mt-1 ${result.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
          {result}
        </p>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-6 w-80 space-y-4">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 size={18} />
              <span className="font-semibold">Datenbank wirklich leeren?</span>
            </div>
            <p className="text-sm text-abraxas-700">
              Alle hochgeladenen Dokumente werden unwiderruflich aus der
              Wissensdatenbank gelöscht. Diese Aktion kann nicht rückgängig
              gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePurge}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600
                           hover:bg-red-700 disabled:opacity-60 text-white text-sm
                           font-medium rounded-lg py-2 transition"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Ja, löschen
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 border border-abraxas-200 text-abraxas-700
                           hover:bg-abraxas-50 disabled:opacity-60 text-sm
                           font-medium rounded-lg py-2 transition"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
