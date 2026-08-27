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

interface IndirectEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: string;
  allocationMethod: string;
}

export default function IndirectCostsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: "Site Management", description: "", amount: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["indirect-costs", currentProject?.id],
    queryFn: async () => (await api.get<IndirectEntry[]>(`/projects/${currentProject!.id}/indirect-costs`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/indirect-costs`, { ...form, date: toIsoDateTime(form.date), amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indirect-costs", currentProject?.id] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div>
      <PageHeader
        title="Indirect Costs"
        description={`Site overhead not tied to a single BOQ item — Total ${formatMoney(total, currency)}`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Log Indirect Cost
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "date", header: "Date", render: (r: IndirectEntry) => formatDate(r.date) },
          { key: "category", header: "Category" },
          { key: "description", header: "Description" },
          { key: "allocationMethod", header: "Allocation" },
          { key: "amount", header: "Amount", align: "right", render: (r: IndirectEntry) => formatMoney(r.amount, currency) },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Log Indirect Cost" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
              <input className="input-field" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Site Offices, Security, Insurance" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount</label>
              <input type="number" className="input-field" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
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
