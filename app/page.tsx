export const dynamic = "force-dynamic";

import Header from "@/components/Header";
import InteractiveLayout from "@/components/InteractiveLayout";

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

        <InteractiveLayout />
      </main>

      <footer className="text-center text-xs text-abraxas-500 py-4">
        © {new Date().getFullYear()} Abraxas · ISDP Wissensagent · Betrieben
        von IBM watsonx Orchestrate
      </footer>
    </div>
  );
}
