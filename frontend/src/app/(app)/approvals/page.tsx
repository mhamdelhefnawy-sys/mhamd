"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, formatDate } from "@/lib/format";
import { Check, X, Undo2 } from "lucide-react";

type ApprovalType = "actual-cost" | "budget" | "variation" | "accrual" | "payment-certificate";

interface ApprovalsData {
  actualCosts: any[];
  budgets: any[];
  variations: any[];
  accruals: any[];
  paymentCertificates: any[];
  totalPending: number;
}

export default function ApprovalsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [actionTarget, setActionTarget] = useState<{ type: ApprovalType; id: string; label: string; mode: "reject" | "return" } | null>(null);

  const { data } = useQuery({
    queryKey: ["approvals", currentProject?.id],
    queryFn: async () => (await api.get<ApprovalsData>(`/projects/${currentProject!.id}/approvals`)).data,
    enabled: !!currentProject,
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ApprovalType; id: string }) =>
      api.post(`/projects/${currentProject!.id}/approvals/${type}/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals", currentProject?.id] }),
  });

  const reasonMutation = useMutation({
    mutationFn: async ({ type, id, mode, reason }: { type: ApprovalType; id: string; mode: "reject" | "return"; reason: string }) =>
      api.post(`/projects/${currentProject!.id}/approvals/${type}/${id}/${mode}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", currentProject?.id] });
      setActionTarget(null);
    },
  });

  if (!data) return <div className="text-slate-500">Loading...</div>;

  const sections: { type: ApprovalType; title: string; rows: any[] }[] = [
    { type: "actual-cost", title: "Pending Actual Costs", rows: data.actualCosts },
    { type: "budget", title: "Pending Budget Changes", rows: data.budgets },
    { type: "variation", title: "Pending Variations", rows: data.variations },
    { type: "accrual", title: "Pending Accruals", rows: data.accruals },
    { type: "payment-certificate", title: "Pending Payment Certificates", rows: data.paymentCertificates },
  ];

  function rowLabel(type: ApprovalType, row: any): string {
    switch (type) {
      case "actual-cost":
        return `${row.description} — ${formatMoney(row.netAmount, currency)}`;
      case "budget":
        return `${row.label} (v${row.version}, ${row._count?.lines ?? 0} lines)`;
      case "variation":
        return `${row.number} — ${row.title} (${formatMoney(row.amount, currency)})`;
      case "accrual":
        return `${row.description} — Accrued ${formatMoney(row.accruedAmount, currency)}`;
      case "payment-certificate":
        return `${row.subcontract?.subcontractor?.companyName ?? ""} — ${row.certificateNumber} (${formatMoney(row.netPayable, currency)})`;
    }
  }

  return (
    <div>
      <PageHeader title="Approval Center" description={`${data.totalPending} item(s) awaiting your decision across all modules.`} />

      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.type} className="panel p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">
              {s.title} <span className="text-slate-500">({s.rows.length})</span>
            </h3>
            {s.rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing pending.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {s.rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      <span className="text-sm text-slate-200">{rowLabel(s.type, row)}</span>
                      {row.date && <span className="text-xs text-slate-500">{formatDate(row.date)}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary !py-1 !border-emerald-800 !text-emerald-400"
                        onClick={() => approveMutation.mutate({ type: s.type, id: row.id })}
                        disabled={approveMutation.isPending}
                        title="Approve"
                      >
                        <Check size={14} /> Approve
                      </button>
                      {s.type !== "budget" && (
                        <button
                          className="btn-secondary !py-1 !border-amber-800 !text-amber-400"
                          onClick={() => setActionTarget({ type: s.type, id: row.id, label: rowLabel(s.type, row) ?? "", mode: "return" })}
                          title="Return for Correction"
                        >
                          <Undo2 size={14} /> Return
                        </button>
                      )}
                      <button
                        className="btn-secondary !py-1 !border-rose-800 !text-rose-400"
                        onClick={() => setActionTarget({ type: s.type, id: row.id, label: rowLabel(s.type, row) ?? "", mode: "reject" })}
                        title="Reject"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {actionTarget && (
        <ReasonModal
          title={actionTarget.mode === "reject" ? "Reject Item" : "Return for Correction"}
          label={actionTarget.label}
          onClose={() => setActionTarget(null)}
          onSubmit={(reason) => reasonMutation.mutate({ ...actionTarget, reason })}
          busy={reasonMutation.isPending}
          error={reasonMutation.isError ? apiErrorMessage(reasonMutation.error) : null}
        />
      )}
    </div>
  );
}

function ReasonModal({
  title,
  label,
  onClose,
  onSubmit,
  busy,
  error,
}: {
  title: string;
  label: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">{label}</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Reason (required)</label>
          <textarea className="input-field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn-primary w-full justify-center" onClick={() => onSubmit(reason)} disabled={!reason.trim() || busy}>
          {busy ? "Saving..." : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
