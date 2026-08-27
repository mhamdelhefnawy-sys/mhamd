"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { LogOut, Bell, ClipboardCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";

export function Topbar() {
  const { user, logout } = useAuth();
  const { projects, currentProject, setCurrentProjectId } = useProject();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", currentProject?.id, "unread"],
    queryFn: async () => (await api.get(`/projects/${currentProject!.id}/alerts`)).data,
    enabled: !!currentProject,
    refetchInterval: 60_000,
  });
  const unread = alerts.filter((a: { isRead: boolean }) => !a.isRead).length;

  const { data: approvals } = useQuery({
    queryKey: ["approvals", currentProject?.id, "count"],
    queryFn: async () => (await api.get(`/projects/${currentProject!.id}/approvals`)).data,
    enabled: !!currentProject,
    refetchInterval: 60_000,
  });
  const pending = approvals?.totalPending ?? 0;

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <select
          className="input-field !w-auto text-sm"
          value={currentProject?.id ?? ""}
          onChange={(e) => setCurrentProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/approvals" className="relative text-slate-400 hover:text-slate-100" title="Approval Center">
          <ClipboardCheck size={18} />
          {pending > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-slate-950">
              {pending}
            </span>
          )}
        </Link>
        <Link href="/alerts" className="relative text-slate-400 hover:text-slate-100">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </Link>
        <div className="text-right leading-tight">
          <div className="text-sm text-slate-200">{user?.fullName}</div>
          <div className="text-[11px] text-slate-500">{user?.roles?.[0]}</div>
        </div>
        <button onClick={logout} className="text-slate-400 hover:text-rose-400" title="Log out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
