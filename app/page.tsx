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
            ISDP Knowledge Gathering
          </h1>
          <p className="text-abraxas-600 mt-1 max-w-2xl">
            Ask the agent about information-security & data-protection
            concepts, attach your own documents, and get grounded answers with
            citations.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="h-[calc(100vh-250px)] min-h-[520px]">
            <Chat />
          </div>

          <aside className="space-y-4">
            <section className="bg-white border border-abraxas-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database size={16} className="text-abraxas-600" />
                <h2 className="font-semibold text-abraxas-900">
                  Add to knowledge base
                </h2>
              </div>
              <DocumentUpload />
            </section>

            <section className="bg-white border border-abraxas-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-abraxas-600" />
                <h2 className="font-semibold text-abraxas-900">
                  Try asking
                </h2>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  What are the key obligations under the Swiss FADP for
                  processing health data?
                </li>
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  Summarise the risk catalogue in the attached
                  Risikoanalyse document.
                </li>
                <li className="border border-abraxas-100 rounded-lg px-3 py-2 hover:border-abraxas-300 cursor-default">
                  Draft a data privacy sheet for a new telemedicine feature.
                </li>
              </ul>
            </section>

            <section className="bg-abraxas-50 border border-abraxas-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-abraxas-500" />
                <h2 className="font-semibold text-abraxas-900">About this agent</h2>
              </div>
              <p className="text-sm text-abraxas-700 leading-relaxed">
                Powered by IBM watsonx Orchestrate. Built for the Abraxas ISDP
                workstream to accelerate information-security and
                data-protection knowledge gathering.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <footer className="text-center text-xs text-abraxas-500 py-4">
        © {new Date().getFullYear()} Abraxas · ISDP Knowledge Agent · Powered
        by IBM watsonx Orchestrate
      </footer>
    </div>
  );
}
