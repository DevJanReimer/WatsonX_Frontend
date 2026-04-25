"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Invalid credentials");
      }
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-abraxas-600 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="18" r="10" stroke="#1a7280" strokeWidth="5" fill="none" />
            <rect x="27" y="8" width="5" height="16" rx="1" fill="#1a7280" />
          </svg>
          <div>
            <div className="text-xl font-bold text-abraxas-700 leading-none tracking-tight">abraxas</div>
            <h1 className="text-sm text-abraxas-500 leading-tight">ISDP Wissensagent · Anmeldung</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-abraxas-700 mb-1">
              Benutzername
            </label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-abraxas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-abraxas-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-abraxas-700 mb-1">
              Passwort
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-abraxas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-abraxas-500"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-abraxas-600 hover:bg-abraxas-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
          >
            <LogIn size={18} />
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>

        <p className="text-xs text-abraxas-500 mt-6 text-center">
          Zugang eingeschränkt · Abraxas ISDP Wissensagent
        </p>
      </div>
    </div>
  );
}
