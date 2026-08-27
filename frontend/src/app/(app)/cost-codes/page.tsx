"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Plus } from "lucide-react";

interface CostCategory {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
interface CostCode {
  id: string;
  code: string;
  description: string;
  division?: string;
  costCategory?: CostCategory | null;
  isActive: boolean;
}

export default function CostCodesPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"codes" | "categories">("codes");
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-categories", currentProject?.id],
    queryFn: async () => (await api.get<CostCategory[]>(`/projects/${currentProject!.id}/cost-coding/categories`)).data,
    enabled: !!currentProject,
  });
  const { data: codes = [] } = useQuery({
    queryKey: ["cost-codes", currentProject?.id],
    queryFn: async () => (await api.get<CostCode[]>(`/projects/${currentProject!.id}/cost-coding/codes`)).data,
    enabled: !!currentProject,
  });

  const [codeForm, setCodeForm] = useState({ code: "", description: "", division: "", costCategoryId: "" });
  const codeMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/cost-coding/codes`, { ...codeForm, costCategoryId: codeForm.costCategoryId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-codes", currentProject?.id] });
      setShowCodeForm(false);
      setCodeForm({ code: "", description: "", division: "", costCategoryId: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [catForm, setCatForm] = useState({ code: "", name: "" });
  const catMutation = useMutation({
    mutationFn: async () => api.post(`/projects/${currentProject!.id}/cost-coding/categories`, catForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories", currentProject?.id] });
      setShowCatForm(false);
      setCatForm({ code: "", name: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Cost Codes & Categories"
        description="Administrator-configurable coding structure — never hard-coded."
        actions={
          tab === "codes" ? (
            <button className="btn-primary" onClick={() => setShowCodeForm(true)}>
              <Plus size={16} /> Add Cost Code
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setShowCatForm(true)}>
              <Plus size={16} /> Add Category
            </button>
          )
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-800">
        {(["codes", "categories"] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-amber-500 text-amber-400" : "text-slate-400"}`}
            onClick={() => setTab(t)}
          >
            {t === "codes" ? "Cost Codes" : "Cost Categories"}
          </button>
        ))}
      </div>

      {tab === "codes" ? (
        <DataTable
          columns={[
            { key: "code", header: "Code" },
            { key: "description", header: "Description" },
            { key: "division", header: "Division" },
            { key: "category", header: "Category", render: (r: CostCode) => r.costCategory?.name ?? "-" },
            { key: "status", header: "Status", render: (r: CostCode) => (r.isActive ? "Active" : "Inactive") },
          ]}
          rows={codes}
        />
      ) : (
        <DataTable
          columns={[
            { key: "code", header: "Code" },
            { key: "name", header: "Name" },
            { key: "status", header: "Status", render: (r: CostCategory) => (r.isActive ? "Active" : "Inactive") },
          ]}
          rows={categories}
        />
      )}

      {showCodeForm && (
        <Modal title="Add Cost Code" onClose={() => setShowCodeForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Code</label>
              <input className="input-field" value={codeForm.code} onChange={(e) => setCodeForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
              <input className="input-field" value={codeForm.description} onChange={(e) => setCodeForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Division</label>
              <input className="input-field" value={codeForm.division} onChange={(e) => setCodeForm((f) => ({ ...f, division: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cost Category</label>
              <select className="input-field" value={codeForm.costCategoryId} onChange={(e) => setCodeForm((f) => ({ ...f, costCategoryId: e.target.value }))}>
                <option value="">(None)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => codeMutation.mutate()} disabled={codeMutation.isPending}>
              {codeMutation.isPending ? "Saving..." : "Create Cost Code"}
            </button>
          </div>
        </Modal>
      )}

      {showCatForm && (
        <Modal title="Add Cost Category" onClose={() => setShowCatForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Code</label>
              <input className="input-field" value={catForm.code} onChange={(e) => setCatForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
              <input className="input-field" value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => catMutation.mutate()} disabled={catMutation.isPending}>
              {catMutation.isPending ? "Saving..." : "Create Category"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
