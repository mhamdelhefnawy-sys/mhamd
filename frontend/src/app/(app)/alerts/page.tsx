"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

interface AlertT {
  id: string;
  severity: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", currentProject?.id],
    queryFn: async () => (await api.get<AlertT[]>(`/projects/${currentProject!.id}/alerts`)).data,
    enabled: !!currentProject,
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/alerts/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts", currentProject?.id] }),
  });

  return (
    <div>
      <PageHeader title="Alerts & Risks" description="Configurable threshold-driven alerts across cost, schedule, and material waste." />

      <div className="panel divide-y divide-slate-800/60">
        {alerts.length === 0 && <p className="p-4 text-sm text-slate-500">No alerts.</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`flex items-start justify-between gap-3 p-3 ${a.isRead ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <SeverityBadge severity={a.severity} />
              <div>
                <p className="text-sm text-slate-200">{a.message}</p>
                <p className="text-xs text-slate-500">{formatDate(a.createdAt)}</p>
              </div>
            </div>
            {!a.isRead && (
              <button className="btn-secondary !py-1 shrink-0" onClick={() => readMutation.mutate(a.id)}>
                Mark Read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
