"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney, toIsoDateTime } from "@/lib/format";
import { Plus, Lock } from "lucide-react";

interface Period {
  id: string;
  periodLabel: string;
  cutoffDate: string;
  status: string;
  finalizedAt: string | null;
}
interface Snapshot {
  id: string;
  reportType: string;
  payloadJson: any;
  createdAt: string;
}

export default function ReportPeriodsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ periodLabel: "", cutoffDate: new Date().toISOString().slice(0, 10) });
  const [viewingPeriod, setViewingPeriod] = useState<Period | null>(null);

  const { data: periods = [] } = useQuery({
    queryKey: ["report-periods", currentProject?.id],
    queryFn: async () => (await api.get<Period[]>(`/projects/${currentProject!.id}/reports/periods`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/reports/periods`, { ...form, cutoffDate: toIsoDateTime(form.cutoffDate) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-periods", currentProject?.id] });
      setShowForm(false);
      setForm({ periodLabel: "", cutoffDate: new Date().toISOString().slice(0, 10) });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/reports/periods/${id}/finalize`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-periods", currentProject?.id] }),
  });

  return (
    <div>
      <PageHeader
        title="Report Periods & Snapshots"
        description="Finalizing a period freezes its KPIs into a read-only snapshot — never recalculated retroactively."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Period
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "periodLabel", header: "Period" },
          { key: "cutoffDate", header: "Cut-off Date", render: (r: Period) => formatDate(r.cutoffDate) },
          { key: "status", header: "Status", render: (r: Period) => <StatusBadge status={r.status} /> },
          { key: "finalizedAt", header: "Finalized", render: (r: Period) => (r.finalizedAt ? formatDate(r.finalizedAt) : "-") },
          {
            key: "actions",
            header: "",
            render: (r: Period) =>
              r.status === "FINALIZED" ? (
                <button className="btn-secondary !py-1" onClick={() => setViewingPeriod(r)}>
                  View Snapshot
                </button>
              ) : (
                <button className="btn-secondary !py-1" onClick={() => finalizeMutation.mutate(r.id)} disabled={finalizeMutation.isPending}>
                  <Lock size={13} /> Finalize
                </button>
              ),
          },
        ]}
        rows={periods}
      />

      {showForm && (
        <Modal title="New Reporting Period" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period Label</label>
              <input
                className="input-field"
                placeholder="e.g. Cost Report No. 05"
                value={form.periodLabel}
                onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cut-off Date</label>
              <input type="date" className="input-field" value={form.cutoffDate} onChange={(e) => setForm((f) => ({ ...f, cutoffDate: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Period"}
            </button>
          </div>
        </Modal>
      )}

      {viewingPeriod && <SnapshotModal period={viewingPeriod} projectId={currentProject!.id} currency={currency} onClose={() => setViewingPeriod(null)} />}
    </div>
  );
}

function SnapshotModal({ period, projectId, currency, onClose }: { period: Period; projectId: string; currency: string; onClose: () => void }) {
  const { data: snapshots = [] } = useQuery({
    queryKey: ["report-snapshots", period.id],
    queryFn: async () => (await api.get<Snapshot[]>(`/projects/${projectId}/reports/periods/${period.id}/snapshots`)).data,
  });
  const payload = snapshots[0]?.payloadJson;

  return (
    <Modal title={`Snapshot — ${period.periodLabel}`} onClose={onClose} wide>
      {!payload ? (
        <p className="text-sm text-slate-500">No snapshot data.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SnapshotRow label="Current Budget (BAC)" value={formatMoney(payload.evm?.bac, currency)} />
          <SnapshotRow label="Actual Cost (AC)" value={formatMoney(payload.evm?.ac, currency)} />
          <SnapshotRow label="Earned Value (EV)" value={formatMoney(payload.evm?.ev, currency)} />
          <SnapshotRow label="Planned Value (PV)" value={formatMoney(payload.evm?.pv, currency)} />
          <SnapshotRow label="CPI" value={String(payload.evm?.cpi)} />
          <SnapshotRow label="SPI" value={String(payload.evm?.spi)} />
          <SnapshotRow label="ETC" value={formatMoney(payload.forecast?.etc, currency)} />
          <SnapshotRow label="EAC" value={formatMoney(payload.forecast?.eac, currency)} />
          <SnapshotRow label="VAC" value={formatMoney(payload.forecast?.vac, currency)} />
          <SnapshotRow label="Forecast Profit" value={formatMoney(payload.profitability?.forecastProfit, currency)} />
        </div>
      )}
      <p className="mt-4 text-xs text-slate-600">This snapshot is immutable — it reflects the state of the project at the moment this period was finalized.</p>
    </Modal>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}
