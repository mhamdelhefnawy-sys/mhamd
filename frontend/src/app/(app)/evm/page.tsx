"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Plus, Camera } from "lucide-react";

interface EvmData {
  evm: { bac: number; pv: number; ev: number; ac: number; cv: number; sv: number; cpi: number; spi: number; tcpi: number };
  forecast: { etc: number; eac: number; vac: number; formulaUsed: string; isManualOverride: boolean };
  exposure: { remainingCommitment: number; accruedAmount: number; costExposure: number };
}
interface Snapshot {
  id: string;
  asOfDate: string;
  cpi: string;
  spi: string;
  eac: string;
  vac: string;
}

export default function EvmPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showOverride, setShowOverride] = useState(false);

  const { data } = useQuery({
    queryKey: ["evm", currentProject?.id],
    queryFn: async () => (await api.get<EvmData>(`/projects/${currentProject!.id}/evm`)).data,
    enabled: !!currentProject,
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["evm-trend", currentProject?.id],
    queryFn: async () => (await api.get<Snapshot[]>(`/projects/${currentProject!.id}/evm/trend`)).data,
    enabled: !!currentProject,
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/evm/snapshot`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evm-trend", currentProject?.id] }),
  });

  if (!data) return <div className="text-slate-500">Loading...</div>;

  const chartData = trend.map((s) => ({ date: formatDate(s.asOfDate), CPI: Number(s.cpi), SPI: Number(s.spi) }));

  return (
    <div>
      <PageHeader
        title="EVM & Forecast"
        description="Earned Value Management — PV / EV / AC / CPI / SPI, and configurable EAC/ETC/VAC."
        actions={
          <>
            <button className="btn-secondary" onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
              <Camera size={16} /> Snapshot
            </button>
            <button className="btn-primary" onClick={() => setShowOverride(true)}>
              <Plus size={16} /> Manual Forecast Override
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
        <KpiCard label="BAC" value={formatMoney(data.evm.bac, currency)} />
        <KpiCard label="PV (Planned Value)" value={formatMoney(data.evm.pv, currency)} />
        <KpiCard label="EV (Earned Value)" value={formatMoney(data.evm.ev, currency)} />
        <KpiCard label="AC (Actual Cost)" value={formatMoney(data.evm.ac, currency)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
        <KpiCard label="CV (Cost Variance)" value={formatMoney(data.evm.cv, currency)} tone={data.evm.cv >= 0 ? "good" : "bad"} />
        <KpiCard label="SV (Schedule Variance)" value={formatMoney(data.evm.sv, currency)} tone={data.evm.sv >= 0 ? "good" : "bad"} />
        <KpiCard label="CPI" value={formatNumber(data.evm.cpi, 3)} tone={data.evm.cpi >= 1 ? "good" : "warn"} />
        <KpiCard label="SPI" value={formatNumber(data.evm.spi, 3)} tone={data.evm.spi >= 1 ? "good" : "warn"} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <KpiCard label="ETC" value={formatMoney(data.forecast.etc, currency)} />
        <KpiCard label="EAC" value={formatMoney(data.forecast.eac, currency)} sub={`Formula: ${data.forecast.formulaUsed}`} />
        <KpiCard label="VAC" value={formatMoney(data.forecast.vac, currency)} tone={data.forecast.vac >= 0 ? "good" : "bad"} />
        <KpiCard label="TCPI" value={formatNumber(data.evm.tcpi, 3)} />
      </div>

      <div className="panel p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">CPI / SPI Trend</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No snapshots yet. Click &quot;Snapshot&quot; to freeze today&apos;s EVM values for trend charting.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, "auto"]} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
              <Legend />
              <Line type="monotone" dataKey="CPI" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="SPI" stroke="#38bdf8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {showOverride && <OverrideModal projectId={currentProject!.id} onClose={() => setShowOverride(false)} />}
    </div>
  );
}

function OverrideModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ scenario: "MOST_LIKELY", manualETC: "", overrideReason: "" });
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${projectId}/evm/forecast-override`, {
        scenario: form.scenario,
        manualETC: Number(form.manualETC),
        overrideReason: form.overrideReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evm", projectId] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  return (
    <Modal title="Manual Forecast Override" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Overrides are always logged to the audit trail with your reason.</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Scenario</label>
          <select className="input-field" value={form.scenario} onChange={(e) => setForm((f) => ({ ...f, scenario: e.target.value }))}>
            <option value="MOST_LIKELY">Most Likely</option>
            <option value="OPTIMISTIC">Optimistic</option>
            <option value="WORST_CASE">Worst Case</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Manual ETC (bottom-up estimate)</label>
          <input type="number" className="input-field" value={form.manualETC} onChange={(e) => setForm((f) => ({ ...f, manualETC: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Reason</label>
          <textarea className="input-field" value={form.overrideReason} onChange={(e) => setForm((f) => ({ ...f, overrideReason: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary w-full justify-center" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Override"}
        </button>
      </div>
    </Modal>
  );
}
