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

interface Commitment {
  id: string;
  type: string;
  number: string;
  vendorName: string;
  originalAmount: string;
  approvedVariations: string;
  revisedAmount: number;
  certifiedAmount: string;
  remaining: number;
  status: string;
}

const TYPES = ["PURCHASE_ORDER", "SUBCONTRACT", "MATERIAL_ORDER", "EQUIPMENT_CONTRACT", "SERVICE_ORDER"];

export default function CommitmentsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "PURCHASE_ORDER", number: "", vendorName: "", originalAmount: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["commitments", currentProject?.id],
    queryFn: async () => (await api.get<Commitment[]>(`/projects/${currentProject!.id}/commitments`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/commitments`, { ...form, originalAmount: Number(form.originalAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments", currentProject?.id] });
      setShowForm(false);
      setForm({ type: "PURCHASE_ORDER", number: "", vendorName: "", originalAmount: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const totalRevised = items.reduce((s, i) => s + i.revisedAmount, 0);
  const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);

  return (
    <div>
      <PageHeader
        title="Commitments"
        description={`Revised total ${formatMoney(totalRevised, currency)} — Remaining ${formatMoney(totalRemaining, currency)}`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Commitment
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "number", header: "No." },
          { key: "type", header: "Type", render: (r: Commitment) => r.type.replace(/_/g, " ") },
          { key: "vendorName", header: "Vendor" },
          { key: "originalAmount", header: "Original", align: "right", render: (r: Commitment) => formatMoney(r.originalAmount, currency) },
          { key: "revisedAmount", header: "Revised", align: "right", render: (r: Commitment) => formatMoney(r.revisedAmount, currency) },
          { key: "certifiedAmount", header: "Certified", align: "right", render: (r: Commitment) => formatMoney(r.certifiedAmount, currency) },
          { key: "remaining", header: "Remaining", align: "right", render: (r: Commitment) => formatMoney(r.remaining, currency) },
          { key: "status", header: "Status", render: (r: Commitment) => <StatusBadge status={r.status} /> },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="New Commitment" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Type</label>
              <select className="input-field" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Number</label>
              <input className="input-field" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Vendor Name</label>
              <input className="input-field" value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Original Amount</label>
              <input type="number" className="input-field" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Commitment"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
