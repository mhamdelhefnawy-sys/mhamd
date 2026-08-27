import { prisma } from "./prisma";

export async function writeAudit(params: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue === undefined ? undefined : (params.oldValue as any),
      newValue: params.newValue === undefined ? undefined : (params.newValue as any),
      reason: params.reason,
    },
  });
}
