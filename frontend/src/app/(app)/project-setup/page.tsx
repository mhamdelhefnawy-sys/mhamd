"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  client?: string;
  mainContractor?: string;
  consultant?: string;
  contractNumber?: string;
  contractType?: string;
  originalContractValue: string;
  currentContractValue: string;
  currency: string;
  vatRate: string;
  projectManager?: string;
  costControlManager?: string;
  status: string;
  location?: string;
  description?: string;
  eacFormula: string;
  headOfficeOverheadPercent: string;
  insuranceRate: string;
  provisionRate: string;
}

const EAC_FORMULAS = [
  { value: "AC_PLUS_ETC", label: "AC + ETC (bottom-up)" },
  { value: "BAC_OVER_CPI", label: "BAC / CPI" },
  { value: "AC_PLUS_BAC_MINUS_EV", label: "AC + (BAC - EV)" },
  { value: "AC_PLUS_BAC_MINUS_EV_OVER_CPI", label: "AC + ((BAC - EV) / CPI)" },
];

export default function ProjectSetupPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const { data: project } = useQuery({
    queryKey: ["project", currentProject?.id],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${currentProject!.id}`)).data,
    enabled: !!currentProject,
  });

  const [form, setForm] = useState<Partial<ProjectDetail>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (project) setForm(project);
  }, [project]);

  const mutation = useMutation({
    mutationFn: async () =>
      api.put(`/projects/${currentProject!.id}`, {
        ...form,
        originalContractValue: Number(form.originalContractValue),
        currentContractValue: Number(form.currentContractValue),
        vatRate: Number(form.vatRate),
        headOfficeOverheadPercent: Number(form.headOfficeOverheadPercent ?? 0),
        insuranceRate: Number(form.insuranceRate ?? 0),
        provisionRate: Number(form.provisionRate ?? 0),
      }),
    onSuccess: () => {
      setMessage("Project updated.");
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  if (!project) return <div className="text-slate-500">Loading...</div>;

  function field(key: keyof ProjectDetail, label: string, type: string = "text") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
        <input
          type={type}
          className="input-field"
          value={(form[key] as string) ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Project Setup"
        description="Master project configuration — currency, contract, key personnel, and forecast methodology."
        actions={<StatusBadge status={project.status} />}
      />

      <div className="panel p-5 space-y-5 max-w-4xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {field("code", "Project Code")}
          {field("name", "Project Name")}
          {field("client", "Client")}
          {field("mainContractor", "Main Contractor")}
          {field("consultant", "Consultant")}
          {field("contractNumber", "Contract Number")}
          {field("contractType", "Contract Type")}
          {field("location", "Project Location")}
          {field("currency", "Currency")}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {field("originalContractValue", "Original Contract Value", "number")}
          {field("currentContractValue", "Current Contract Value", "number")}
          {field("projectManager", "Project Manager")}
          {field("costControlManager", "Cost Control Manager")}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">EAC Formula</label>
            <select
              className="input-field"
              value={form.eacFormula ?? "AC_PLUS_ETC"}
              onChange={(e) => setForm((f) => ({ ...f, eacFormula: e.target.value }))}
            >
              {EAC_FORMULAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
          <textarea
            className="input-field"
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Taxes & Overhead</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {field("vatRate", "VAT Rate (%)", "number")}
            {field("headOfficeOverheadPercent", "Head Office Overhead (% of Actual Cost)", "number")}
            {field("insuranceRate", "Insurance Rate (%)", "number")}
            {field("provisionRate", "Provision Rate (%)", "number")}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Applied at project level against posted Actual Cost. See Reports → Taxes & Overhead for the computed amounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
          {message && <span className="text-sm text-slate-400">{message}</span>}
        </div>
      </div>
    </div>
  );
}
