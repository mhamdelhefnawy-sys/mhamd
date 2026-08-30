"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Check {
  key: string;
  label: string;
  status: "PASS" | "WARNING" | "ERROR";
  count: number;
  message: string;
}
interface ReconciliationData {
  checks: Check[];
  overallStatus: "PASS" | "WARNING" | "ERROR";
  errorCount: number;
  warningCount: number;
  passCount: number;
}

const STATUS_META = {
  PASS: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-800" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-800" },
  ERROR: { icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-800" },
} as const;

export default function ReconciliationPage() {
  const { currentProject } = useProject();
  const { data } = useQuery({
    queryKey: ["reconciliation", currentProject?.id],
    queryFn: async () => (await api.get<ReconciliationData>(`/projects/${currentProject!.id}/reconciliation`)).data,
    enabled: !!currentProject,
  });

  if (!data) return <div className="text-slate-500">Loading...</div>;

  const overall = STATUS_META[data.overallStatus];
  const OverallIcon = overall.icon;

  return (
    <div>
      <PageHeader
        title="Reconciliation / Zero-Check"
        description="Data-integrity checks the Cost Control Manager should clear before issuing a report."
      />

      <div className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${overall.bg}`}>
        <OverallIcon className={overall.color} size={22} />
        <div>
          <div className={`text-sm font-semibold ${overall.color}`}>Overall Status: {data.overallStatus}</div>
          <div className="text-xs text-slate-400">
            {data.passCount} passed · {data.warningCount} warning(s) · {data.errorCount} error(s)
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.checks.map((c) => {
          const meta = STATUS_META[c.status];
          const Icon = meta.icon;
          return (
            <div key={c.key} className={`flex items-start gap-3 rounded-lg border p-3 ${meta.bg}`}>
              <Icon className={`${meta.color} mt-0.5 shrink-0`} size={18} />
              <div>
                <div className="text-sm font-medium text-slate-100">{c.label}</div>
                <div className="text-xs text-slate-400">{c.message}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
