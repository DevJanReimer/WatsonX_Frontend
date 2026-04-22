"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, LogIn } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-abarxas-800 via-abarxas-700 to-abarxas-500 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="text-abarxas-600" size={32} />
          <div>
            <div className="text-xs uppercase tracking-wider text-abarxas-500">
              Abarxas
            </div>
            <h1 className="text-2xl font-bold text-abarxas-900">
              ISDP Agent Sign-in
            </h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-abarxas-700 mb-1">
              Username
            </label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-abarxas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-abarxas-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-abarxas-700 mb-1">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-abarxas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-abarxas-500"
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
            className="w-full flex items-center justify-center gap-2 bg-abarxas-600 hover:bg-abarxas-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
          >
            <LogIn size={18} />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-abarxas-500 mt-6 text-center">
          Access restricted · Abarxas ISDP Knowledge Gathering Agent
        </p>
      </div>
    </div>
  );
}
