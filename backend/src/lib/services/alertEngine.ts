import { prisma } from "../prisma";
import { evaluateMetric, AlertRuleLike } from "../calc/alerts";

// Turns the configurable AlertRule thresholds (spec §37/§38) into real Alert rows.
// Dedupes against the same metric within the last 24h so this can be called on
// every dashboard load without spamming duplicate alerts.
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function shouldCreate(projectId: string, entityType: string, entityId: string): Promise<boolean> {
  const recent = await prisma.alert.findFirst({
    where: {
      projectId,
      entityType,
      entityId,
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
  });
  return !recent;
}

export async function evaluateProjectAlerts(
  projectId: string,
  metrics: { cpi: number; spi: number; vac: number; eac: number; unallocatedCost: number }
): Promise<void> {
  const rules = await prisma.alertRule.findMany({ where: { projectId, isActive: true } });
  const rulesByMetric = (metric: string): AlertRuleLike[] =>
    rules.filter((r) => r.metric === metric).map((r) => ({ metric: r.metric, operator: r.operator as AlertRuleLike["operator"], threshold: Number(r.threshold), severity: r.severity }));

  // CPI / SPI thresholds
  for (const [metric, value] of [
    ["CPI", metrics.cpi],
    ["SPI", metrics.spi],
  ] as const) {
    const projectRules = rulesByMetric(metric);
    if (projectRules.length === 0) continue;
    const { severity, rule } = evaluateMetric(value, projectRules);
    if (severity === "GREEN") continue;
    if (await shouldCreate(projectId, "EVM_METRIC", metric)) {
      await prisma.alert.create({
        data: {
          projectId,
          severity,
          message: `${metric} is ${value} — below the ${rule?.threshold} threshold configured for ${severity} status.`,
          entityType: "EVM_METRIC",
          entityId: metric,
        },
      });
    }
  }

  // Negative VAC (forecast overrun) — always relevant regardless of configured rules.
  if (metrics.vac < 0 && (await shouldCreate(projectId, "VAC", "PROJECT"))) {
    await prisma.alert.create({
      data: {
        projectId,
        severity: "RED",
        message: `Forecast overrun: VAC is negative (${metrics.vac.toLocaleString()}) — the project is trending over the current budget.`,
        entityType: "VAC",
        entityId: "PROJECT",
      },
    });
  }

  // EAC increase vs the last snapshot
  const lastSnapshot = await prisma.eVMSnapshot.findFirst({
    where: { projectId, scope: "PROJECT" },
    orderBy: { asOfDate: "desc" },
  });
  if (lastSnapshot && metrics.eac > Number(lastSnapshot.eac) && (await shouldCreate(projectId, "EAC_INCREASE", "PROJECT"))) {
    const delta = metrics.eac - Number(lastSnapshot.eac);
    await prisma.alert.create({
      data: {
        projectId,
        severity: "YELLOW",
        message: `EAC increased by ${delta.toLocaleString()} since the last snapshot (${new Date(lastSnapshot.asOfDate).toLocaleDateString()}).`,
        entityType: "EAC_INCREASE",
        entityId: "PROJECT",
      },
    });
  }

  // Unallocated cost
  if (metrics.unallocatedCost > 0 && (await shouldCreate(projectId, "UNALLOCATED_COST", "PROJECT"))) {
    await prisma.alert.create({
      data: {
        projectId,
        severity: metrics.unallocatedCost > 100_000 ? "RED" : "YELLOW",
        message: `Unallocated cost of ${metrics.unallocatedCost.toLocaleString()} requires coding.`,
        entityType: "UNALLOCATED_COST",
        entityId: "PROJECT",
      },
    });
  }
}
