"use client";

import { ShieldCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-abarxas-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-abarxas-700 to-abarxas-500 flex items-center justify-center">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-abarxas-500 leading-tight">
              Abarxas
            </div>
            <div className="font-semibold text-abarxas-900 leading-tight">
              ISDP Knowledge Agent
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-abarxas-600 hover:text-abarxas-900"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  );
}
