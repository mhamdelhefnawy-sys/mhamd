"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney, formatNumber } from "@/lib/format";
import { Plus, Upload, Download } from "lucide-react";

interface BoqItem {
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: string;
  unitRate: string;
  totalAmount: string;
  status: string;
  wbs?: { name: string } | null;
  costCode?: { code: string } | null;
}

const REQUIRED_FIELDS = ["itemNumber", "description", "unit", "quantity", "unitRate"];

export default function BoqPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const currency = currentProject?.currency ?? "SAR";
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["boq", currentProject?.id],
    queryFn: async () => (await api.get<BoqItem[]>(`/projects/${currentProject!.id}/boq`)).data,
    enabled: !!currentProject,
  });

  const [form, setForm] = useState({ itemNumber: "", description: "", unit: "", quantity: "", unitRate: "" });
  const createMutation = useMutation({
    mutationFn: async () =>
      api.post(`/projects/${currentProject!.id}/boq`, {
        ...form,
        quantity: Number(form.quantity),
        unitRate: Number(form.unitRate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boq", currentProject?.id] });
      setShowForm(false);
      setForm({ itemNumber: "", description: "", unit: "", quantity: "", unitRate: "" });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const total = items.reduce((s, i) => s + Number(i.totalAmount), 0);

  return (
    <div>
      <PageHeader
        title="Bill of Quantities"
        description={`${items.length} items — Total ${formatMoney(total, currency)}`}
        actions={
          <>
            <a
              className="btn-secondary"
              href={`${process.env.NEXT_PUBLIC_API_URL}/projects/${currentProject?.id}/boq/export`}
              onClick={(e) => downloadWithAuth(e, `${process.env.NEXT_PUBLIC_API_URL}/projects/${currentProject?.id}/boq/export`, "BOQ.xlsx")}
            >
              <Download size={16} /> Export
            </a>
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Import Excel
            </button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add Item
            </button>
          </>
        }
      />

      <DataTable
        columns={[
          { key: "itemNumber", header: "Item No." },
          { key: "description", header: "Description" },
          { key: "unit", header: "Unit" },
          { key: "quantity", header: "Quantity", align: "right", render: (r: BoqItem) => formatNumber(r.quantity) },
          { key: "unitRate", header: "Rate", align: "right", render: (r: BoqItem) => formatNumber(r.unitRate) },
          { key: "totalAmount", header: "Amount", align: "right", render: (r: BoqItem) => formatMoney(r.totalAmount, currency) },
          { key: "wbs", header: "WBS", render: (r: BoqItem) => r.wbs?.name ?? "-" },
          { key: "costCode", header: "Cost Code", render: (r: BoqItem) => r.costCode?.code ?? "-" },
          { key: "status", header: "Status", render: (r: BoqItem) => <StatusBadge status={r.status} /> },
        ]}
        rows={items}
      />

      {showForm && (
        <Modal title="Add BOQ Item" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            {(["itemNumber", "description", "unit", "quantity", "unitRate"] as const).map((k) => (
              <div key={k}>
                <label className="mb-1 block text-xs font-medium text-slate-400 capitalize">{k.replace(/([A-Z])/g, " $1")}</label>
                <input
                  type={k === "quantity" || k === "unitRate" ? "number" : "text"}
                  className="input-field"
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create BOQ Item"}
            </button>
          </div>
        </Modal>
      )}

      {showImport && <ImportWizard projectId={currentProject!.id} onClose={() => setShowImport(false)} />}
    </div>
  );
}

function downloadWithAuth(e: React.MouseEvent, url: string, filename: string) {
  e.preventDefault();
  const token = window.localStorage.getItem("ccc_token");
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    });
}

function ImportWizard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "map" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/projects/${projectId}/boq/import/preview`, fd);
      setHeaders(res.data.headers);
      setStep("map");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("commit", String(commit));
      const res = await api.post(`/projects/${projectId}/boq/import/validate`, fd);
      setValidation(res.data);
      if (commit) {
        queryClient.invalidateQueries({ queryKey: ["boq", projectId] });
        setStep("result");
      } else {
        setStep("result");
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setValidation((err as any)?.response?.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import BOQ from Excel" onClose={onClose} wide>
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Upload an Excel BOQ (.xlsx). You will map columns to system fields before anything is committed.</p>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-slate-300" />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="btn-primary" onClick={handleUpload} disabled={!file || busy}>
            {busy ? "Reading file..." : "Continue"}
          </button>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Map each required system field to an Excel column.</p>
          <div className="grid grid-cols-2 gap-3">
            {[...REQUIRED_FIELDS, "division", "section"].map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium text-slate-400 capitalize">
                  {field} {REQUIRED_FIELDS.includes(field) && <span className="text-rose-400">*</span>}
                </label>
                <select className="input-field" value={mapping[field] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}>
                  <option value="">(Not mapped)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => handleValidate(false)} disabled={busy}>
              {busy ? "Validating..." : "Preview & Validate"}
            </button>
          </div>
        </div>
      )}

      {step === "result" && validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="panel p-3">
              <div className="text-slate-500">Total Rows</div>
              <div className="text-lg text-slate-100">{validation.summary?.totalRows ?? "-"}</div>
            </div>
            <div className="panel p-3">
              <div className="text-slate-500">Valid Rows</div>
              <div className="text-lg text-emerald-400">{validation.summary?.validRows ?? validation.imported ?? "-"}</div>
            </div>
            <div className="panel p-3">
              <div className="text-slate-500">Failed Rows</div>
              <div className="text-lg text-rose-400">{validation.summary?.failedRows ?? 0}</div>
            </div>
          </div>

          {validation.errors?.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded border border-rose-900/40 bg-rose-950/20 p-2 text-xs">
              {validation.errors.map((e: any, idx: number) => (
                <div key={idx} className="text-rose-300">
                  Row {e.row}: {e.field} — {e.message}
                </div>
              ))}
            </div>
          )}

          {validation.imported !== undefined ? (
            <p className="text-sm text-emerald-400">Successfully imported {validation.imported} BOQ items.</p>
          ) : (
            <button
              className="btn-primary"
              onClick={() => handleValidate(true)}
              disabled={busy || (validation.errors?.length ?? 0) > 0}
            >
              {busy ? "Importing..." : `Commit ${validation.valid?.length ?? 0} Rows`}
            </button>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
