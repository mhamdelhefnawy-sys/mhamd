"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";
import { Plus } from "lucide-react";

interface Subcontract {
  id: string;
  contractNumber: string;
  scope?: string;
  originalValue: string;
  revisedValue: string;
  certifiedToDate: number;
  remainingCommitment: number;
  status: string;
}
interface Subcontractor {
  id: string;
  companyName: string;
  scope?: string;
  subcontracts: Subcontract[];
}

export default function SubcontractorsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ companyName: "", scope: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["subcontractors", currentProject?.id],
    queryFn: async () => (await api.get<Subcontractor[]>(`/projects/${currentProject!.id}/subcontractors`)).data,
    enabled: !!currentProject,
  });

  const createMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/subcontractors`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", currentProject?.id] });
      setShowForm(false);
      setForm({ companyName: "", scope: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Subcontractors"
        description="Contract value, certified amount, and remaining commitment per subcontract."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Subcontractor
          </button>
        }
      />

      <div className="space-y-4">
        {items.map((s) => (
          <div key={s.id} className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{s.companyName}</h3>
                <p className="text-xs text-slate-500">{s.scope}</p>
              </div>
            </div>
            {s.subcontracts.length === 0 ? (
              <p className="text-sm text-slate-500">No subcontracts yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract No.</th>
                    <th>Scope</th>
                    <th className="text-right">Original</th>
                    <th className="text-right">Revised</th>
                    <th className="text-right">Certified</th>
                    <th className="text-right">Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.subcontracts.map((sc) => (
                    <tr key={sc.id}>
                      <td>{sc.contractNumber}</td>
                      <td>{sc.scope}</td>
                      <td className="text-right">{formatMoney(sc.originalValue, currency)}</td>
                      <td className="text-right">{formatMoney(sc.revisedValue, currency)}</td>
                      <td className="text-right">{formatMoney(sc.certifiedToDate, currency)}</td>
                      <td className="text-right">{formatMoney(sc.remainingCommitment, currency)}</td>
                      <td>
                        <StatusBadge status={sc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">No subcontractors yet.</p>}
      </div>

      {showForm && (
        <Modal title="New Subcontractor" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Company Name</label>
              <input className="input-field" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Scope</label>
              <input className="input-field" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Subcontractor"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
