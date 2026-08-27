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

interface Accrual {
  id: string;
  periodDate: string;
  description: string;
  workDoneAmount: string;
  invoicedAmount: string;
  accruedAmount: string;
}

export default function AccrualsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ periodDate: new Date().toISOString().slice(0, 10), description: "", workDoneAmount: "", invoicedAmount: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["accruals", currentProject?.id],
    queryFn: async () => (await api.get<Accrual[]>(`/projects/${currentProject!.id}/accruals`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/accruals`, {
        ...form,
        periodDate: toIsoDateTime(form.periodDate),
        workDoneAmount: Number(form.workDoneAmount),
        invoicedAmount: Number(form.invoicedAmount || 0),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accruals", currentProject?.id] });
      setShowForm(false);
      setForm({ periodDate: new Date().toISOString().slice(0, 10), description: "", workDoneAmount: "", invoicedAmount: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const totalAccrued = items.reduce((s, i) => s + Number(i.accruedAmount), 0);

  return (
    <div>
      <PageHeader
        title="Accruals"
        description={`Work done but not yet invoiced — Total accrued ${formatMoney(totalAccrued, currency)}`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Accrual
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "periodDate", header: "Period", render: (r: Accrual) => formatDate(r.periodDate) },
          { key: "description", header: "Description" },
          { key: "workDoneAmount", header: "Work Done", align: "right", render: (r: Accrual) => formatMoney(r.workDoneAmount, currency) },
          { key: "invoicedAmount", header: "Invoiced", align: "right", render: (r: Accrual) => formatMoney(r.invoicedAmount, currency) },
          { key: "accruedAmount", header: "Accrued", align: "right", render: (r: Accrual) => formatMoney(r.accruedAmount, currency) },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="New Accrual" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period Date</label>
              <input type="date" className="input-field" value={form.periodDate} onChange={(e) => setForm((f) => ({ ...f, periodDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Work Done Amount</label>
              <input type="number" className="input-field" value={form.workDoneAmount} onChange={(e) => setForm((f) => ({ ...f, workDoneAmount: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Invoiced Amount</label>
              <input type="number" className="input-field" value={form.invoicedAmount} onChange={(e) => setForm((f) => ({ ...f, invoicedAmount: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Accrual"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
