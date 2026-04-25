import Chat from "@/components/Chat";
import DocumentUpload from "@/components/DocumentUpload";
import Header from "@/components/Header";
import { BookOpen, Sparkles, Database } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <section className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-abraxas-900">
            ISDP Wissenserhebung
          </h1>
          <p className="text-abraxas-600 mt-1 max-w-2xl">
            Stellen Sie dem Agenten Fragen zu Informationssicherheit und
            Datenschutz, laden Sie eigene Dokumente hoch und erhalten Sie
            fundierte Antworten mit Quellenangaben.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="h-[calc(100vh-200px)] min-h-[600px]">
            <Chat />
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
            </section>

            <section className="bg-white border border-abraxas-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-abraxas-600" />
                <h2 className="font-semibold text-abraxas-900">
                  Beispielfragen
                </h2>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  Welche Hauptpflichten gelten gemäss dem Schweizer DSG bei der
                  Bearbeitung von Gesundheitsdaten?
                </li>
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  Fasse den Risikokatalog im beigefügten
                  Risikoanalyse-Dokument zusammen.
                </li>
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  Erstelle ein Datenschutzblatt für eine neue Telemedizin-Funktion.
                </li>
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
      </main>

      <footer className="text-center text-xs text-abraxas-500 py-4">
        © {new Date().getFullYear()} Abraxas · ISDP Wissensagent · Betrieben
        von IBM watsonx Orchestrate
      </footer>
    </div>
  );
}
