"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-abraxas-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Abraxas "a" logomark — circle + vertical bar */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="18" r="10" stroke="#1a7280" strokeWidth="5" fill="none" />
            <rect x="27" y="8" width="5" height="16" rx="1" fill="#1a7280" />
          </svg>
          <div>
            <div className="text-lg font-bold text-abraxas-700 leading-none tracking-tight">
              abraxas
            </div>
            <div className="text-[11px] text-abraxas-400 leading-tight tracking-wide">
              ISDP Wissensagent
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-abraxas-500 hover:text-abraxas-700 transition-colors"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </div>
    </header>
  );
}
