import { prisma } from "../prisma";

// Central place that turns raw transactions into the KPI values used by
// /evm, /forecast, and /dashboard so every consumer sees the same numbers
// (per requirement §83/§84 — reproducible, traceable, server-side only).

export async function getCurrentBudgetTotal(projectId: string): Promise<number> {
  const approved = await prisma.budget.findFirst({ where: { projectId, status: "APPROVED" } });
  const budget = approved ?? (await prisma.budget.findFirst({ where: { projectId }, orderBy: { version: "desc" } }));
  if (budget) {
    const agg = await prisma.budgetLine.aggregate({ where: { budgetId: budget.id }, _sum: { budgetAmount: true } });
    if (agg._sum.budgetAmount) return Number(agg._sum.budgetAmount);
  }
  const boqAgg = await prisma.bOQItem.aggregate({ where: { projectId }, _sum: { totalAmount: true } });
  return Number(boqAgg._sum.totalAmount ?? 0);
}

export async function getActualCostTotal(
  projectId: string,
  filter: { wbsId?: string; costCodeId?: string; boqItemId?: string } = {}
): Promise<number> {
  const agg = await prisma.actualCostTransaction.aggregate({
    where: { projectId, status: "POSTED", ...filter },
    _sum: { netAmount: true },
  });
  return Number(agg._sum.netAmount ?? 0);
}

export async function getCommittedRemaining(projectId: string): Promise<number> {
  const commitments = await prisma.commitment.findMany({ where: { projectId } });
  return round2(
    commitments.reduce((sum, c) => {
      const revised = Number(c.originalAmount) + Number(c.approvedVariations);
      return sum + Math.max(0, revised - Number(c.certifiedAmount));
    }, 0)
  );
}

export async function getAccruedTotal(projectId: string): Promise<number> {
  const agg = await prisma.accrual.aggregate({ where: { projectId }, _sum: { accruedAmount: true } });
  return Number(agg._sum.accruedAmount ?? 0);
}

export async function getUnallocatedTotal(projectId: string): Promise<number> {
  const agg = await prisma.actualCostTransaction.aggregate({
    where: { projectId, isUnallocated: true },
    _sum: { netAmount: true },
  });
  return Number(agg._sum.netAmount ?? 0);
}

// Weighted-BOQ progress: each BOQ item's latest recorded % complete, weighted by its
// share of total BOQ value. Falls back to an explicit project-level manual entry if present.
export async function getProjectProgress(projectId: string): Promise<{ plannedPercent: number; actualPercent: number }> {
  const projectLevel = await prisma.progressEntry.findFirst({
    where: { projectId, wbsId: null, boqItemId: null, costCodeId: null },
    orderBy: { date: "desc" },
  });

  const boqItems = await prisma.bOQItem.findMany({ where: { projectId }, select: { id: true, totalAmount: true } });
  const totalValue = boqItems.reduce((s, i) => s + Number(i.totalAmount), 0);

  let weightedActual = 0;
  let weightedPlanned = 0;
  if (totalValue > 0) {
    for (const item of boqItems) {
      const latest = await prisma.progressEntry.findFirst({ where: { boqItemId: item.id }, orderBy: { date: "desc" } });
      const weight = Number(item.totalAmount) / totalValue;
      weightedActual += (latest?.actualPercent ? Number(latest.actualPercent) : 0) * weight;
      weightedPlanned += (latest?.plannedPercent ? Number(latest.plannedPercent) : 0) * weight;
    }
  }

  return {
    plannedPercent: round4(projectLevel?.plannedPercent != null ? Number(projectLevel.plannedPercent) : weightedPlanned),
    actualPercent: round4(projectLevel?.actualPercent != null ? Number(projectLevel.actualPercent) : weightedActual),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
