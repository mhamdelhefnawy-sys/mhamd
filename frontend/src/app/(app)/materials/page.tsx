"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { formatMoney, formatNumber, formatPercent, toIsoDateTime } from "@/lib/format";
import { Plus, PackagePlus, Wrench } from "lucide-react";

interface MaterialRow {
  id: string;
  code: string;
  description: string;
  unit: string;
  allowedWastePercent: number;
  standardRate: number | null;
  receivedQty: number;
  issuedQty: number;
  consumedQty: number;
  balanceQty: number;
  totalLossCost: number;
}

export default function MaterialsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [receiptFor, setReceiptFor] = useState<MaterialRow | null>(null);
  const [consumptionFor, setConsumptionFor] = useState<MaterialRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", description: "", unit: "", allowedWastePercent: "2", standardRate: "" });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", currentProject?.id],
    queryFn: async () => (await api.get<MaterialRow[]>(`/projects/${currentProject!.id}/materials`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/materials`, {
        ...form,
        allowedWastePercent: Number(form.allowedWastePercent),
        standardRate: form.standardRate ? Number(form.standardRate) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", currentProject?.id] });
      setShowForm(false);
      setForm({ code: "", description: "", unit: "", allowedWastePercent: "2", standardRate: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Materials & Storage"
        description="Purchase → Receipt → Storage → Issue → Consumption → Loss tracking, with automatic waste calculation."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Material
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "code", header: "Code" },
          { key: "description", header: "Description" },
          { key: "unit", header: "Unit" },
          { key: "receivedQty", header: "Received", align: "right", render: (r: MaterialRow) => formatNumber(r.receivedQty) },
          { key: "issuedQty", header: "Issued", align: "right", render: (r: MaterialRow) => formatNumber(r.issuedQty) },
          { key: "consumedQty", header: "Consumed", align: "right", render: (r: MaterialRow) => formatNumber(r.consumedQty) },
          { key: "balanceQty", header: "Balance", align: "right", render: (r: MaterialRow) => formatNumber(r.balanceQty) },
          { key: "allowedWastePercent", header: "Allowed Waste", align: "right", render: (r: MaterialRow) => formatPercent(r.allowedWastePercent) },
          { key: "totalLossCost", header: "Loss Cost", align: "right", render: (r: MaterialRow) => formatMoney(r.totalLossCost, currency) },
          {
            key: "actions",
            header: "",
            render: (r: MaterialRow) => (
              <div className="flex gap-2">
                <button className="btn-secondary !py-1" onClick={() => setReceiptFor(r)} title="Record receipt">
                  <PackagePlus size={14} />
                </button>
                <button className="btn-secondary !py-1" onClick={() => setConsumptionFor(r)} title="Record consumption">
                  <Wrench size={14} />
                </button>
              </div>
            ),
          },
        ]}
        rows={materials}
      />

      {showForm && (
        <Modal title="Add Material" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Code</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit</label>
              <input className="input-field" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Allowed Waste %</label>
                <input type="number" className="input-field" value={form.allowedWastePercent} onChange={(e) => setForm((f) => ({ ...f, allowedWastePercent: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Standard Rate</label>
                <input type="number" className="input-field" value={form.standardRate} onChange={(e) => setForm((f) => ({ ...f, standardRate: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Material"}
            </button>
          </div>
        </Modal>
      )}

      {receiptFor && <ReceiptModal material={receiptFor} projectId={currentProject!.id} onClose={() => setReceiptFor(null)} />}
      {consumptionFor && <ConsumptionModal material={consumptionFor} projectId={currentProject!.id} onClose={() => setConsumptionFor(null)} />}
    </div>
  );
}

function ReceiptModal({ material, projectId, onClose }: { material: MaterialRow; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), supplier: "", quantity: "", unitRate: String(material.standardRate ?? "") });
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${projectId}/materials/${material.id}/receipts`, {
        ...form,
        date: toIsoDateTime(form.date),
        quantity: Number(form.quantity),
        unitRate: Number(form.unitRate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", projectId] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <Modal title={`Record Receipt — ${material.code}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
          <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Supplier</label>
          <input className="input-field" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Quantity</label>
            <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Unit Rate</label>
            <input type="number" className="input-field" value={form.unitRate} onChange={(e) => setForm((f) => ({ ...f, unitRate: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary w-full justify-center" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Record Receipt"}
        </button>
      </div>
    </Modal>
  );
}

function ConsumptionModal({ material, projectId, onClose }: { material: MaterialRow; projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), budgetQuantity: "", quantity: "" });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const mutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${projectId}/materials/${material.id}/consumptions`, {
        ...form,
        date: toIsoDateTime(form.date),
        budgetQuantity: Number(form.budgetQuantity),
        quantity: Number(form.quantity),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["materials", projectId] });
      setResult(res.data.loss);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <Modal title={`Record Consumption — ${material.code}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
          <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Budget Quantity (theoretical)</label>
            <input type="number" className="input-field" value={form.budgetQuantity} onChange={(e) => setForm((f) => ({ ...f, budgetQuantity: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Actual Quantity Used</label>
            <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {result && (
          <div className={`rounded-md border p-3 text-sm ${result.isOverAllowed ? "border-rose-800 bg-rose-950/30 text-rose-300" : "border-emerald-800 bg-emerald-950/30 text-emerald-300"}`}>
            Actual waste: {formatPercent(result.actualWastePercent)} (allowed {formatPercent(material.allowedWastePercent)}).{" "}
            {result.isOverAllowed ? `Excess cost: ${formatMoney(result.excessCost)}` : "Within allowed waste."}
          </div>
        )}
        {!result && (
          <button className="btn-primary w-full justify-center" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Record Consumption"}
          </button>
        )}
      </div>
    </Modal>
  );
}
