"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  roles?: string[];
  permissions?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem("ccc_user");
    const token = window.localStorage.getItem("ccc_token");
    if (stored && token) {
      setUser(JSON.parse(stored));
      api
        .get("/auth/me")
        .then((res) => {
          const merged = { ...JSON.parse(stored), ...res.data.user };
          setUser(merged);
          window.localStorage.setItem("ccc_user", JSON.stringify(merged));
        })
        .catch(() => {
          /* interceptor handles redirect on 401 */
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    window.localStorage.setItem("ccc_token", res.data.token);
    window.localStorage.setItem("ccc_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    const me = await api.get("/auth/me");
    const merged = { ...res.data.user, ...me.data.user };
    window.localStorage.setItem("ccc_user", JSON.stringify(merged));
    setUser(merged);
    router.push("/");
  }

  function logout() {
    window.localStorage.removeItem("ccc_token");
    window.localStorage.removeItem("ccc_user");
    window.localStorage.removeItem("ccc_project_id");
    setUser(null);
    router.push("/login");
  }

  function hasPermission(module: string, action: string) {
    if (!user) return false;
    if (user.roles?.includes("Super Administrator")) return true;
    return !!user.permissions?.includes(`${module}:${action}`);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
