"use client";

import { useState } from "react";
import { BookOpen, Sparkles, Database } from "lucide-react";
import Chat from "@/components/Chat";
import DocumentUpload from "@/components/DocumentUpload";
import PurgeButton from "@/components/PurgeButton";

const EXAMPLES = [
  "Greife auf deine Wissensdatenbank zu und sage mir, wie man mit Backups umgeht.",
  "Fasse den Risikokatalog mit Hilfe deiner Wissensdatenbank zusammen.",
  "Welche Regeln und Vorschriften gibt es bei ISDP Konzepten?",
];

export default function InteractiveLayout() {
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [promptKey,     setPromptKey]     = useState(0);

  function selectExample(text: string) {
    setPendingPrompt(text);
    setPromptKey(k => k + 1);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <Chat pendingPrompt={pendingPrompt} promptKey={promptKey} />
      </div>

      <aside className="space-y-4">
        <section className="bg-white border border-abraxas-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-abraxas-600" />
            <h2 className="font-semibold text-abraxas-900">
              Zur Wissensdatenbank hinzufügen
            </h2>
          </div>
          <DocumentUpload />
          <div className="mt-3 pt-3 border-t border-abraxas-100">
            <PurgeButton />
          </div>
        </section>

        <section className="bg-white border border-abraxas-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-abraxas-600" />
            <h2 className="font-semibold text-abraxas-900">Beispielfragen</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {EXAMPLES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => selectExample(q)}
                  className="w-full text-left border border-abraxas-100 rounded-lg px-3 py-2
                             hover:border-abraxas-400 hover:bg-abraxas-50 transition text-abraxas-700"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-abraxas-50 border border-abraxas-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-abraxas-500" />
            <h2 className="font-semibold text-abraxas-900">Über diesen Agenten</h2>
          </div>
          <p className="text-sm text-abraxas-700 leading-relaxed">
            Betrieben von IBM watsonx Orchestrate. Entwickelt für den Abraxas
            ISDP-Workstream zur Beschleunigung der Wissenserhebung im Bereich
            Informationssicherheit und Datenschutz.
          </p>
        </section>
      </aside>
    </div>
  );
}
