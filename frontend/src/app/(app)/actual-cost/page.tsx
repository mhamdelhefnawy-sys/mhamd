"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, formatDate, toIsoDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

interface CostCode {
  id: string;
  code: string;
  description: string;
}
interface ActualTx {
  id: string;
  date: string;
  description: string;
  supplier?: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  status: string;
  isUnallocated: boolean;
  costCode?: { code: string } | null;
}

export default function ActualCostPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [unallocatedOnly, setUnallocatedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allocatingTx, setAllocatingTx] = useState<ActualTx | null>(null);

  const { data } = useQuery({
    queryKey: ["actual-costs", currentProject?.id, unallocatedOnly],
    queryFn: async () =>
      (await api.get(`/projects/${currentProject!.id}/actual-costs`, { params: { unallocatedOnly, pageSize: 100 } })).data as {
        items: ActualTx[];
        total: number;
      },
    enabled: !!currentProject,
  });
  const { data: costCodes = [] } = useQuery({
    queryKey: ["cost-codes", currentProject?.id],
    queryFn: async () => (await api.get<CostCode[]>(`/projects/${currentProject!.id}/cost-coding/codes`)).data,
    enabled: !!currentProject,
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    supplier: "",
    netAmount: "",
    vatAmount: "",
    costCodeId: "",
  });
  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/actual-costs`, {
        ...form,
        date: toIsoDateTime(form.date),
        netAmount: Number(form.netAmount),
        vatAmount: Number(form.vatAmount || 0),
        costCodeId: form.costCodeId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actual-costs", currentProject?.id] });
      setShowForm(false);
      setForm({ date: new Date().toISOString().slice(0, 10), description: "", supplier: "", netAmount: "", vatAmount: "", costCodeId: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.post(`/projects/${currentProject!.id}/actual-costs/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actual-costs", currentProject?.id] }),
  });

  const allocateMutation = useMutation({
    mutationFn: async ({ id, costCodeId }: { id: string; costCodeId: string }) =>
      api.post(`/projects/${currentProject!.id}/actual-costs/${id}/allocate`, { allocations: [{ costCodeId, percentage: 100 }] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actual-costs", currentProject?.id] });
      setAllocatingTx(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Actual Cost"
        description="Draft → Submitted → Reviewed → Approved → Posted. Posted transactions are never edited directly."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Record Cost
          </button>
        }
      />

      <label className="mb-3 flex items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" checked={unallocatedOnly} onChange={(e) => setUnallocatedOnly(e.target.checked)} />
        Show unallocated only
      </label>

      <DataTable
        columns={[
          { key: "date", header: "Date", render: (r: ActualTx) => formatDate(r.date) },
          { key: "description", header: "Description" },
          { key: "supplier", header: "Supplier", render: (r: ActualTx) => r.supplier ?? "-" },
          { key: "costCode", header: "Cost Code", render: (r: ActualTx) => r.costCode?.code ?? (r.isUnallocated ? "UNALLOCATED" : "-") },
          { key: "netAmount", header: "Net Amount", align: "right", render: (r: ActualTx) => formatMoney(r.netAmount, currency) },
          { key: "grossAmount", header: "Gross Amount", align: "right", render: (r: ActualTx) => formatMoney(r.grossAmount, currency) },
          { key: "status", header: "Status", render: (r: ActualTx) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r: ActualTx) => (
              <div className="flex gap-2">
                {r.isUnallocated && (
                  <button className="btn-secondary !py-1" onClick={() => setAllocatingTx(r)}>
                    Allocate
                  </button>
                )}
                {r.status === "DRAFT" && (
                  <button className="btn-secondary !py-1" onClick={() => statusMutation.mutate({ id: r.id, status: "SUBMITTED" })}>
                    Submit
                  </button>
                )}
                {r.status === "SUBMITTED" && (
                  <button className="btn-secondary !py-1" onClick={() => statusMutation.mutate({ id: r.id, status: "APPROVED" })}>
                    Approve
                  </button>
                )}
                {r.status === "APPROVED" && (
                  <button className="btn-secondary !py-1" onClick={() => statusMutation.mutate({ id: r.id, status: "POSTED" })}>
                    Post
                  </button>
                )}
              </div>
            ),
          },
        ]}
        rows={data?.items ?? []}
      />

      {showForm && (
        <Modal title="Record Actual Cost" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Supplier</label>
              <input className="input-field" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Net Amount</label>
                <input type="number" className="input-field" value={form.netAmount} onChange={(e) => setForm((f) => ({ ...f, netAmount: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">VAT Amount</label>
                <input type="number" className="input-field" value={form.vatAmount} onChange={(e) => setForm((f) => ({ ...f, vatAmount: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cost Code (leave blank to record as unallocated)</label>
              <select className="input-field" value={form.costCodeId} onChange={(e) => setForm((f) => ({ ...f, costCodeId: e.target.value }))}>
                <option value="">(Unallocated)</option>
                {costCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.description}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Record Transaction"}
            </button>
          </div>
        </Modal>
      )}

      {allocatingTx && (
        <Modal title={`Allocate: ${allocatingTx.description}`} onClose={() => setAllocatingTx(null)}>
          <AllocateForm costCodes={costCodes} onSubmit={(costCodeId) => allocateMutation.mutate({ id: allocatingTx.id, costCodeId })} busy={allocateMutation.isPending} />
        </Modal>
      )}
    </div>
  );
}

function AllocateForm({ costCodes, onSubmit, busy }: { costCodes: CostCode[]; onSubmit: (costCodeId: string) => void; busy: boolean }) {
  const [costCodeId, setCostCodeId] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Simple 100% allocation to a single cost code. Use the API for multi-way splits.</p>
      <select className="input-field" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)}>
        <option value="">Select cost code...</option>
        {costCodes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.description}
          </option>
        ))}
      </select>
      <button className="btn-primary w-full justify-center" disabled={!costCodeId || busy} onClick={() => onSubmit(costCodeId)}>
        {busy ? "Allocating..." : "Allocate 100%"}
      </button>
    </div>
  );
}
