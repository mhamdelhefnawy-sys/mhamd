"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  reason?: string;
  createdAt: string;
  user?: { fullName: string; email: string } | null;
}

export default function AuditLogPage() {
  const { data } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => (await api.get("/admin/audit-log", { params: { pageSize: 100 } })).data as { items: AuditEntry[]; total: number },
  });

  return (
    <div>
      <PageHeader title="Audit Trail" description={`${data?.total ?? 0} recorded actions. Every budget, cost, approval, and permission change is tracked.`} />

      <DataTable
        columns={[
          { key: "createdAt", header: "Timestamp", render: (r: AuditEntry) => new Date(r.createdAt).toLocaleString() },
          { key: "user", header: "User", render: (r: AuditEntry) => r.user?.fullName ?? "System" },
          { key: "action", header: "Action" },
          { key: "entityType", header: "Entity" },
          { key: "entityId", header: "Entity ID", className: "font-mono text-xs" },
          { key: "reason", header: "Reason", render: (r: AuditEntry) => r.reason ?? "-" },
        ]}
        rows={data?.items ?? []}
      />
    </div>
  );
}
