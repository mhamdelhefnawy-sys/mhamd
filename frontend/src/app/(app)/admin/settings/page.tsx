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
      <PageHeader title="System Settings" description="Role permission matrix and alert threshold configuration — nothing here is hard-coded." />

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
