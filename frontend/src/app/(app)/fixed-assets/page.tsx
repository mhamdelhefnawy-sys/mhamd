"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { formatMoney, toIsoDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

interface FixedAsset {
  id: string;
  assetTag: string;
  description: string;
  purchaseCost: string;
  usefulLifeMonths: number;
  depreciationEntries: { netBookValue: string; accumulatedDepreciation: string }[];
}

export default function FixedAssetsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ assetTag: "", description: "", purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: "", usefulLifeMonths: "36" });

  const { data: items = [] } = useQuery({
    queryKey: ["fixed-assets", currentProject?.id],
    queryFn: async () => (await api.get<FixedAsset[]>(`/projects/${currentProject!.id}/fixed-assets`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/fixed-assets`, {
        ...form,
        purchaseDate: toIsoDateTime(form.purchaseDate),
        purchaseCost: Number(form.purchaseCost),
        usefulLifeMonths: Number(form.usefulLifeMonths),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed-assets", currentProject?.id] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const depreciateMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/fixed-assets/${id}/depreciate`, { periodDate: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixed-assets", currentProject?.id] }),
  });

  return (
    <div>
      <PageHeader
        title="Fixed Assets"
        description="Straight-line depreciation, net book value tracking."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Asset
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "assetTag", header: "Asset Tag" },
          { key: "description", header: "Description" },
          { key: "purchaseCost", header: "Purchase Cost", align: "right", render: (r: FixedAsset) => formatMoney(r.purchaseCost, currency) },
          { key: "usefulLifeMonths", header: "Useful Life (mo)", align: "right" },
          {
            key: "nbv",
            header: "Net Book Value",
            align: "right",
            render: (r: FixedAsset) =>
              r.depreciationEntries.length
                ? formatMoney(r.depreciationEntries[r.depreciationEntries.length - 1].netBookValue, currency)
                : formatMoney(r.purchaseCost, currency),
          },
          {
            key: "actions",
            header: "",
            render: (r: FixedAsset) => (
              <button className="btn-secondary !py-1" onClick={() => depreciateMutation.mutate(r.id)}>
                Post Monthly Depreciation
              </button>
            ),
          },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Add Fixed Asset" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Asset Tag</label>
              <input className="input-field" value={form.assetTag} onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Purchase Date</label>
              <input type="date" className="input-field" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Purchase Cost</label>
                <input type="number" className="input-field" value={form.purchaseCost} onChange={(e) => setForm((f) => ({ ...f, purchaseCost: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Useful Life (months)</label>
                <input type="number" className="input-field" value={form.usefulLifeMonths} onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Asset"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
