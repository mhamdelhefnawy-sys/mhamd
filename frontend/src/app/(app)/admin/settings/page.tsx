"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";
import { PageHeader } from "@/components/PageHeader";

interface Permission {
  module: string;
  action: string;
  allowed: boolean;
}
interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Permission[];
}

const MODULES = [
  "projects", "wbs", "cost_codes", "boq", "budget", "variations", "actual_cost",
  "commitments", "accruals", "subcontractors", "materials", "manpower", "equipment",
  "indirect_costs", "fixed_assets", "progress", "forecast", "evm", "reports", "approvals",
];
const ACTIONS = ["view", "create", "edit", "delete", "approve", "post", "export"];

interface AlertRule {
  id: string;
  metric: string;
  operator: string;
  threshold: string;
  severity: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await api.get<Role[]>("/admin/roles")).data,
  });
  const { data: alertRules = [] } = useQuery({
    queryKey: ["alert-rules", currentProject?.id],
    queryFn: async () => (await api.get<AlertRule[]>(`/projects/${currentProject!.id}/alerts/rules`)).data,
    enabled: !!currentProject,
  });

  const role = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const [pending, setPending] = useState<Record<string, boolean>>({});

  function isAllowed(module: string, action: string) {
    const key = `${module}:${action}`;
    if (key in pending) return pending[key];
    return role?.permissions.some((p) => p.module === module && p.action === action && p.allowed) ?? false;
  }

  function toggle(module: string, action: string) {
    const key = `${module}:${action}`;
    setPending((p) => ({ ...p, [key]: !isAllowed(module, action) }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(pending).map(([key, allowed]) => {
        const [module, action] = key.split(":");
        return { module, action, allowed };
      });
      return api.put(`/admin/roles/${role!.id}/permissions`, { permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setPending({});
    },
  });

  return (
    <div>
      <PageHeader title="System Settings" description="Company branding, role permission matrix, and alert threshold configuration — nothing here is hard-coded." />

      <CompanyBrandingPanel />

      <div className="panel p-4 mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Role Permission Matrix</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              className={`btn-secondary !py-1 ${role?.id === r.id ? "!border-amber-500 !text-amber-400" : ""}`}
              onClick={() => {
                setSelectedRoleId(r.id);
                setPending({});
              }}
            >
              {r.name}
            </button>
          ))}
        </div>

        {role && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="text-center capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m}>
                      <td className="capitalize">{m.replace(/_/g, " ")}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="text-center">
                          <input type="checkbox" checked={isAllowed(m, a)} onChange={() => toggle(m, a)} disabled={role.isSystem} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {role.isSystem ? (
              <p className="mt-2 text-xs text-slate-500">Super Administrator always has full access and cannot be restricted.</p>
            ) : (
              <button className="btn-primary mt-3" onClick={() => saveMutation.mutate()} disabled={Object.keys(pending).length === 0 || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Permission Changes"}
              </button>
            )}
          </>
        )}
      </div>

      <div className="panel p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Alert Thresholds ({currentProject?.name})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Operator</th>
              <th>Threshold</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {alertRules.map((r) => (
              <tr key={r.id}>
                <td>{r.metric}</td>
                <td>{r.operator}</td>
                <td>{r.threshold}</td>
                <td>{r.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Company {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

function CompanyBrandingPanel() {
  const queryClient = useQueryClient();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await api.get<Company>("/company")).data,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (fields: Partial<Company>) => api.put("/company", fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      setMessage("Saved.");
    },
  });

  function handleLogoFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setLogoPreview(dataUri);
      mutation.mutate({ logoUrl: dataUri });
    };
    reader.readAsDataURL(file);
  }

  const logo = logoPreview ?? company?.logoUrl;

  return (
    <div className="panel p-4 mb-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Company Branding</h3>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded border border-slate-800 bg-slate-900">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Company logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-600">No logo</span>
          )}
        </div>
        <div>
          <label className="btn-secondary cursor-pointer">
            Upload Logo
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoFile(file);
              }}
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">PNG or JPEG. Appears on generated PDF reports.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Company Name</label>
          <input
            className="input-field"
            defaultValue={company?.name}
            onBlur={(e) => mutation.mutate({ name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Address</label>
          <input
            className="input-field"
            defaultValue={company?.address ?? ""}
            onBlur={(e) => mutation.mutate({ address: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Phone</label>
          <input
            className="input-field"
            defaultValue={company?.phone ?? ""}
            onBlur={(e) => mutation.mutate({ phone: e.target.value })}
          />
        </div>
      </div>
      {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
    </div>
  );
}
