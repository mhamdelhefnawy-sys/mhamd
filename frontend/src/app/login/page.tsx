"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@albina.sa");
  const [password, setPassword] = useState("Passw0rd!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="text-amber-500" size={36} />
          <h1 className="text-lg font-semibold text-slate-100">Construction Cost Control</h1>
          <p className="text-sm text-slate-500">Project Cost Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-center text-xs text-slate-600">Demo: admin@albina.sa / Passw0rd!123</p>
        </form>
      </div>
    </div>
  );
}
