"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { formatDate, formatPercent, toIsoDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

interface ProgressEntryT {
  id: string;
  date: string;
  method: string;
  plannedPercent: string | null;
  actualPercent: string | null;
  wbs?: { name: string } | null;
  boqItem?: { itemNumber: string; description: string } | null;
}
interface BoqItem {
  id: string;
  itemNumber: string;
  description: string;
  quantity: string;
}

export default function ProgressPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["progress-summary", currentProject?.id],
    queryFn: async () => (await api.get(`/projects/${currentProject!.id}/progress/summary`)).data,
    enabled: !!currentProject,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["progress", currentProject?.id],
    queryFn: async () => (await api.get<ProgressEntryT[]>(`/projects/${currentProject!.id}/progress`)).data,
    enabled: !!currentProject,
  });
  const { data: boqItems = [] } = useQuery({
    queryKey: ["boq", currentProject?.id],
    queryFn: async () => (await api.get<BoqItem[]>(`/projects/${currentProject!.id}/boq`)).data,
    enabled: !!currentProject,
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    method: "MANUAL",
    boqItemId: "",
    plannedPercent: "",
    actualPercent: "",
    executedQuantity: "",
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/progress`, {
        date: toIsoDateTime(form.date),
        method: form.method,
        boqItemId: form.boqItemId || null,
        plannedPercent: form.plannedPercent ? Number(form.plannedPercent) : null,
        actualPercent: form.method !== "QUANTITY_BASED" && form.actualPercent ? Number(form.actualPercent) : null,
        executedQuantity: form.method === "QUANTITY_BASED" ? Number(form.executedQuantity) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["progress-summary", currentProject?.id] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Progress"
        description="Manual %, quantity-based, or weighted-BOQ progress methods."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Record Progress
          </button>
        }
      />

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <KpiCard label="Planned Progress" value={formatPercent(summary.plannedPercent)} />
          <KpiCard label="Actual Progress" value={formatPercent(summary.actualPercent)} />
          <KpiCard label="Variance" value={formatPercent(summary.variance)} tone={summary.variance >= 0 ? "good" : "bad"} />
        </div>
      )}

      <DataTable
        columns={[
          { key: "date", header: "Date", render: (r: ProgressEntryT) => formatDate(r.date) },
          { key: "scope", header: "Scope", render: (r: ProgressEntryT) => r.boqItem ? `${r.boqItem.itemNumber} — ${r.boqItem.description}` : r.wbs?.name ?? "Project" },
          { key: "method", header: "Method" },
          { key: "plannedPercent", header: "Planned %", align: "right", render: (r: ProgressEntryT) => (r.plannedPercent ? formatPercent(r.plannedPercent) : "-") },
          { key: "actualPercent", header: "Actual %", align: "right", render: (r: ProgressEntryT) => (r.actualPercent ? formatPercent(r.actualPercent) : "-") },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Record Progress" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Method</label>
              <select className="input-field" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="MANUAL">Manual %</option>
                <option value="QUANTITY_BASED">Quantity-based</option>
                <option value="WEIGHTED_BOQ">Weighted BOQ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">BOQ Item (optional — leave blank for project-level)</label>
              <select className="input-field" value={form.boqItemId} onChange={(e) => setForm((f) => ({ ...f, boqItemId: e.target.value }))}>
                <option value="">(Project level)</option>
                {boqItems.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.itemNumber} — {b.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Planned %</label>
              <input type="number" className="input-field" value={form.plannedPercent} onChange={(e) => setForm((f) => ({ ...f, plannedPercent: e.target.value }))} />
            </div>
            {form.method === "QUANTITY_BASED" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Executed Quantity</label>
                <input type="number" className="input-field" value={form.executedQuantity} onChange={(e) => setForm((f) => ({ ...f, executedQuantity: e.target.value }))} />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Actual %</label>
                <input type="number" className="input-field" value={form.actualPercent} onChange={(e) => setForm((f) => ({ ...f, actualPercent: e.target.value }))} />
              </div>
            )}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Record Progress"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
