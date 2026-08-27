"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, formatDate } from "@/lib/format";

interface BudgetSummary {
  originalBudget: number;
  approvedVariations: number;
  revisedBudget: number;
  currentBudget: number;
}
interface Budget {
  id: string;
  version: number;
  label: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  _count: { lines: number };
}
interface BoqItem {
  id: string;
  totalAmount: string;
  quantity: string;
  unitRate: string;
  wbsId: string | null;
  costCodeId: string | null;
}

export default function BudgetPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["budget-summary", currentProject?.id],
    queryFn: async () => (await api.get<BudgetSummary>(`/projects/${currentProject!.id}/budget/summary`)).data,
    enabled: !!currentProject,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", currentProject?.id],
    queryFn: async () => (await api.get<Budget[]>(`/projects/${currentProject!.id}/budget`)).data,
    enabled: !!currentProject,
  });
  const { data: boqItems = [] } = useQuery({
    queryKey: ["boq", currentProject?.id],
    queryFn: async () => (await api.get<BoqItem[]>(`/projects/${currentProject!.id}/boq`)).data,
    enabled: !!currentProject,
  });

  const createFromBoq = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/budget`, {
        label: budgets.length === 0 ? "Original Budget" : `Revision ${budgets.length}`,
        lines: boqItems.map((b) => ({
          wbsId: b.wbsId,
          boqItemId: b.id,
          costCodeId: b.costCodeId,
          budgetQuantity: Number(b.quantity),
          budgetRate: Number(b.unitRate),
          budgetAmount: Number(b.totalAmount),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary", currentProject?.id] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/projects/${currentProject!.id}/budget/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary", currentProject?.id] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Budget"
        description="Original → Approved Variations → Revised → Current Budget (BAC)."
        actions={
          <button className="btn-primary" onClick={() => createFromBoq.mutate()} disabled={createFromBoq.isPending || boqItems.length === 0}>
            {createFromBoq.isPending ? "Generating..." : `Generate ${budgets.length === 0 ? "Original" : "Revision"} from BOQ`}
          </button>
        }
      />

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          <KpiCard label="Original Budget" value={formatMoney(summary.originalBudget, currency)} />
          <KpiCard label="Approved Variations" value={formatMoney(summary.approvedVariations, currency)} />
          <KpiCard label="Revised Budget" value={formatMoney(summary.revisedBudget, currency)} />
          <KpiCard label="Current Budget (BAC)" value={formatMoney(summary.currentBudget, currency)} tone="good" />
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-300">Budget Versions</h3>
      <DataTable
        columns={[
          { key: "version", header: "Version" },
          { key: "label", header: "Label" },
          { key: "lines", header: "Lines", render: (r: Budget) => r._count?.lines ?? 0 },
          { key: "status", header: "Status", render: (r: Budget) => <StatusBadge status={r.status} /> },
          { key: "createdAt", header: "Created", render: (r: Budget) => formatDate(r.createdAt) },
          {
            key: "actions",
            header: "",
            render: (r: Budget) =>
              r.status !== "APPROVED" && (
                <button className="btn-secondary !py-1" onClick={() => approveMutation.mutate(r.id)}>
                  Approve
                </button>
              ),
          },
        ]}
        rows={budgets}
      />
    </div>
  );
}
