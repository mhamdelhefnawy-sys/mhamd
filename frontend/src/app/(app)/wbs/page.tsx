"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { Plus, ChevronRight } from "lucide-react";

interface WbsNode {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  level: number;
}

export default function WbsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ parentId: "", code: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: nodes = [] } = useQuery({
    queryKey: ["wbs", currentProject?.id],
    queryFn: async () => (await api.get<WbsNode[]>(`/projects/${currentProject!.id}/wbs`)).data,
    enabled: !!currentProject,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/wbs`, { ...form, parentId: form.parentId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wbs", currentProject?.id] });
      setShowForm(false);
      setForm({ parentId: "", code: "", name: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function buildTree(parentId: string | null): WbsNode[] {
    return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.code.localeCompare(b.code));
  }

  function renderNode(node: WbsNode, depth: number) {
    const children = buildTree(node.id);
    return (
      <div key={node.id}>
        <div className="flex items-center gap-2 py-1.5 border-b border-slate-800/60" style={{ paddingLeft: depth * 20 }}>
          {children.length > 0 ? <ChevronRight size={14} className="text-slate-600" /> : <span className="w-3.5" />}
          <span className="text-xs font-mono text-amber-400">{node.code}</span>
          <span className="text-sm text-slate-200">{node.name}</span>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = buildTree(null);

  return (
    <div>
      <PageHeader
        title="Work Breakdown Structure"
        description="Unlimited-depth hierarchy: Division → Building → Zone → Work Package."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Node
          </button>
        }
      />

      <div className="panel p-4">{roots.length === 0 ? <p className="text-sm text-slate-500">No WBS nodes yet.</p> : roots.map((n) => renderNode(n, 0))}</div>

      {showForm && (
        <Modal title="Add WBS Node" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Parent Node</label>
              <select className="input-field" value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
                <option value="">(Top level)</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {"—".repeat(n.level)} {n.code} {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Code</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create Node"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
