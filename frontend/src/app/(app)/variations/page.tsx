"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";
import { Plus } from "lucide-react";

interface VariationT {
  id: string;
  number: string;
  title: string;
  amount: string;
  status: string;
}

export default function VariationsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ number: "", title: "", description: "", amount: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["variations", currentProject?.id],
    queryFn: async () => (await api.get<VariationT[]>(`/projects/${currentProject!.id}/variations`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/variations`, { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variations", currentProject?.id] });
      setShowForm(false);
      setForm({ number: "", title: "", description: "", amount: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/variations/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variations", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary", currentProject?.id] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/variations/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["variations", currentProject?.id] }),
  });

  return (
    <div>
      <PageHeader
        title="Variations"
        description="Approved variations feed directly into the Current Budget roll-up."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Variation
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "number", header: "No." },
          { key: "title", header: "Title" },
          { key: "amount", header: "Amount", align: "right", render: (r: VariationT) => formatMoney(r.amount, currency) },
          { key: "status", header: "Status", render: (r: VariationT) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r: VariationT) =>
              r.status === "DRAFT" || r.status === "SUBMITTED" ? (
                <div className="flex gap-2">
                  <button className="btn-secondary !py-1" onClick={() => approveMutation.mutate(r.id)}>
                    Approve
                  </button>
                  <button className="btn-secondary !py-1" onClick={() => rejectMutation.mutate(r.id)}>
                    Reject
                  </button>
                </div>
              ) : null,
          },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="New Variation" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Number</label>
              <input className="input-field" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
              <input className="input-field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <textarea className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount (+/-)</label>
              <input type="number" className="input-field" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Variation"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
