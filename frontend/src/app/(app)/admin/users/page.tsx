"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Plus } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  isActive: boolean;
  roles: string[];
}
interface Role {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<UserRow[]>("/admin/users")).data,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await api.get<Role[]>("/admin/roles")).data,
  });

  const [form, setForm] = useState({ email: "", password: "", fullName: "", jobTitle: "", roleIds: [] as string[] });

  const createMutation = useMutation({
    mutationFn: async () => api.post("/admin/users", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowForm(false);
      setForm({ email: "", password: "", fullName: "", jobTitle: "", roleIds: [] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/admin/users/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Super Administrator manages users, role assignment, and account status."
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New User
          </button>
        }
      />

      <DataTable
        columns={[
          { key: "fullName", header: "Name" },
          { key: "email", header: "Email" },
          { key: "jobTitle", header: "Job Title", render: (r: UserRow) => r.jobTitle ?? "-" },
          { key: "roles", header: "Roles", render: (r: UserRow) => r.roles.join(", ") },
          {
            key: "status",
            header: "Status",
            render: (r: UserRow) => (
              <button
                className={`badge ${r.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}
                onClick={() => toggleActiveMutation.mutate({ id: r.id, isActive: !r.isActive })}
              >
                {r.isActive ? "Active" : "Inactive"}
              </button>
            ),
          },
        ]}
        rows={users}
      />

      {showForm && (
        <Modal title="New User" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Full Name</label>
              <input className="input-field" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
              <input type="password" className="input-field" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Job Title</label>
              <input className="input-field" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Roles</label>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-slate-800 p-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          roleIds: e.target.checked ? [...f.roleIds, r.id] : f.roleIds.filter((id) => id !== r.id),
                        }))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn-primary w-full justify-center" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
