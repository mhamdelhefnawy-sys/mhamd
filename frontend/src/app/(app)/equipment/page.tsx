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

interface EquipmentEntry {
  id: string;
  date: string;
  equipmentName: string;
  equipmentType?: string;
  ownership: string;
  operatingHours: string;
  totalCost: string;
}

export default function EquipmentPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    equipmentName: "",
    equipmentType: "",
    ownership: "RENTED",
    dailyRate: "",
    operatingHours: "0",
    standbyHours: "0",
    fuelCost: "0",
    maintenanceCost: "0",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["equipment", currentProject?.id],
    queryFn: async () => (await api.get<EquipmentEntry[]>(`/projects/${currentProject!.id}/equipment`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/equipment`, {
        ...form,
        date: toIsoDateTime(form.date),
        dailyRate: form.dailyRate ? Number(form.dailyRate) : null,
        operatingHours: Number(form.operatingHours),
        standbyHours: Number(form.standbyHours),
        fuelCost: Number(form.fuelCost),
        maintenanceCost: Number(form.maintenanceCost),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", currentProject?.id] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Owned & rented equipment usage cost, including fuel and maintenance."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Log Equipment Usage
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "date", header: "Date", render: (r: EquipmentEntry) => formatDate(r.date) },
          { key: "equipmentName", header: "Equipment" },
          { key: "equipmentType", header: "Type", render: (r: EquipmentEntry) => r.equipmentType ?? "-" },
          { key: "ownership", header: "Ownership" },
          { key: "operatingHours", header: "Op. Hours", align: "right" },
          { key: "totalCost", header: "Total Cost", align: "right", render: (r: EquipmentEntry) => formatMoney(r.totalCost, currency) },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Log Equipment Usage" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Equipment Name</label>
              <input className="input-field" value={form.equipmentName} onChange={(e) => setForm((f) => ({ ...f, equipmentName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Type</label>
                <input className="input-field" value={form.equipmentType} onChange={(e) => setForm((f) => ({ ...f, equipmentType: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Ownership</label>
                <select className="input-field" value={form.ownership} onChange={(e) => setForm((f) => ({ ...f, ownership: e.target.value }))}>
                  <option value="OWNED">Owned</option>
                  <option value="RENTED">Rented</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Daily Rate</label>
                <input type="number" className="input-field" value={form.dailyRate} onChange={(e) => setForm((f) => ({ ...f, dailyRate: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Operating Hours</label>
                <input type="number" className="input-field" value={form.operatingHours} onChange={(e) => setForm((f) => ({ ...f, operatingHours: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Fuel Cost</label>
                <input type="number" className="input-field" value={form.fuelCost} onChange={(e) => setForm((f) => ({ ...f, fuelCost: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Maintenance Cost</label>
                <input type="number" className="input-field" value={form.maintenanceCost} onChange={(e) => setForm((f) => ({ ...f, maintenanceCost: e.target.value }))} />
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
