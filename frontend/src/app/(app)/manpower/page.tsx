"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { formatMoney, formatDate, toIsoDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

interface ManpowerEntry {
  id: string;
  date: string;
  category: string;
  trade?: string;
  headcount: string;
  days?: string;
  rate: string;
  totalCost: string;
}

export default function ManpowerPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: "Skilled", trade: "", headcount: "1", days: "1", rate: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["manpower", currentProject?.id],
    queryFn: async () => (await api.get<ManpowerEntry[]>(`/projects/${currentProject!.id}/manpower`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/manpower`, {
        ...form,
        date: toIsoDateTime(form.date),
        headcount: Number(form.headcount),
        days: Number(form.days),
        rate: Number(form.rate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manpower", currentProject?.id] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Manpower"
        description="Skilled / unskilled / supervision labor cost, by trade and cost code."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Log Manpower
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "date", header: "Date", render: (r: ManpowerEntry) => formatDate(r.date) },
          { key: "category", header: "Category" },
          { key: "trade", header: "Trade", render: (r: ManpowerEntry) => r.trade ?? "-" },
          { key: "headcount", header: "Headcount", align: "right" },
          { key: "days", header: "Days", align: "right" },
          { key: "rate", header: "Rate", align: "right", render: (r: ManpowerEntry) => formatMoney(r.rate, currency) },
          { key: "totalCost", header: "Total Cost", align: "right", render: (r: ManpowerEntry) => formatMoney(r.totalCost, currency) },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Log Manpower" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {["Skilled", "Unskilled", "Supervisor", "Engineer", "Management"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Trade</label>
              <input className="input-field" value={form.trade} onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Headcount</label>
                <input type="number" className="input-field" value={form.headcount} onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Days</label>
                <input type="number" className="input-field" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Daily Rate</label>
                <input type="number" className="input-field" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Log Entry"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
