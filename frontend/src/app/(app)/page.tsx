"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/StatusBadge";
import { formatMoney, formatNumber, formatPercent, formatDate } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#fb923c", "#22d3ee", "#facc15"];

interface DashboardData {
  project: { currency: string };
  contract: { contractValue: number; currentBudget: number };
  cost: {
    actualCost: number;
    committedCost: number;
    accruedCost: number;
    eac: number;
    etc: number;
    vac: number;
    costExposure: number;
    unallocatedCost: number;
  };
  progress: { plannedPercent: number; actualPercent: number; variance: number };
  performance: { cpi: number; spi: number; cv: number; sv: number; cpiSeverity: string; spiSeverity: string };
  profitability: { forecastProfit: number; forecastMarginPercent: number };
  costByCategory: { name: string; amount: number }[];
  costByWorkPackage: { name: string; budgetAmount: number }[];
  topOverruns: { boqItemId: string; itemNumber: string; description: string; budgetAmount: number; actualAmount: number; overrun: number; overrunPercent: number }[];
  alerts: { id: string; severity: string; message: string; createdAt: string }[];
}

export default function DashboardPage() {
  const { currentProject } = useProject();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", currentProject?.id],
    queryFn: async () => (await api.get<DashboardData>(`/projects/${currentProject!.id}/dashboard`)).data,
    enabled: !!currentProject,
  });

  if (isLoading || !data) return <div className="text-slate-500">Loading dashboard...</div>;
  const currency = data.project?.currency ?? "SAR";

  return (
    <div>
      <PageHeader title="Executive Dashboard" description={`As of ${formatDate(new Date())}`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 mb-4">
        <KpiCard label="Contract Value" value={formatMoney(data.contract.contractValue, currency)} />
        <KpiCard label="Current Budget" value={formatMoney(data.contract.currentBudget, currency)} />
        <KpiCard label="Actual Cost" value={formatMoney(data.cost.actualCost, currency)} />
        <KpiCard label="Committed" value={formatMoney(data.cost.committedCost, currency)} />
        <KpiCard
          label="EAC"
          value={formatMoney(data.cost.eac, currency)}
          tone={data.cost.eac > data.contract.currentBudget ? "bad" : "good"}
        />
        <KpiCard
          label="VAC"
          value={formatMoney(data.cost.vac, currency)}
          tone={data.cost.vac >= 0 ? "good" : "bad"}
          sub={data.cost.vac >= 0 ? "Under budget" : "Over budget"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <KpiCard label="Physical Progress" value={formatPercent(data.progress.actualPercent)} sub={`Planned ${formatPercent(data.progress.plannedPercent)}`} />
        <KpiCard
          label="CPI"
          value={formatNumber(data.performance.cpi, 2)}
          tone={data.performance.cpiSeverity === "GREEN" ? "good" : data.performance.cpiSeverity === "RED" || data.performance.cpiSeverity === "BLACK" ? "bad" : "warn"}
        />
        <KpiCard
          label="SPI"
          value={formatNumber(data.performance.spi, 2)}
          tone={data.performance.spiSeverity === "GREEN" ? "good" : data.performance.spiSeverity === "RED" || data.performance.spiSeverity === "BLACK" ? "bad" : "warn"}
        />
        <KpiCard label="Forecast Margin" value={formatPercent(data.profitability.forecastMarginPercent)} />
        <KpiCard label="Cost Variance (CV)" value={formatMoney(data.performance.cv, currency)} tone={data.performance.cv >= 0 ? "good" : "bad"} />
      </div>

      {data.cost.unallocatedCost > 0 && (
        <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          Unallocated cost of {formatMoney(data.cost.unallocatedCost, currency)} requires coding. Visit Reports → Unallocated Cost.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Cost by Category</h3>
          {data.costByCategory.length === 0 ? (
            <p className="text-sm text-slate-500">No posted actual costs yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.costByCategory} dataKey="amount" nameKey="name" innerRadius={55} outerRadius={90}>
                  {data.costByCategory.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v as number, currency)} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Budget by Work Package</h3>
          {data.costByWorkPackage.length === 0 ? (
            <p className="text-sm text-slate-500">No work packages defined.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.costByWorkPackage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip formatter={(v) => formatMoney(v as number, currency)} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Bar dataKey="budgetAmount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Top Cost Overruns</h3>
          {data.topOverruns.length === 0 ? (
            <p className="text-sm text-slate-500">No BOQ items currently exceed budget.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Overrun</th>
                </tr>
              </thead>
              <tbody>
                {data.topOverruns.map((o) => (
                  <tr key={o.boqItemId}>
                    <td>
                      <div className="text-slate-200">{o.itemNumber}</div>
                      <div className="text-xs text-slate-500">{o.description}</div>
                    </td>
                    <td className="text-right">{formatMoney(o.budgetAmount, currency)}</td>
                    <td className="text-right">{formatMoney(o.actualAmount, currency)}</td>
                    <td className="text-right text-rose-400">
                      {formatMoney(o.overrun, currency)} ({formatPercent(o.overrunPercent)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Alerts & Risks</h3>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-slate-500">No active alerts.</p>
          ) : (
            <ul className="space-y-2">
              {data.alerts.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-slate-300">{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
