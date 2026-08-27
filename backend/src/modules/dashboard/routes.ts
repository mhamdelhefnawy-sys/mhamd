import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler } from "../../lib/http";
import { computeProjectEvmAndForecast } from "../evm/routes";
import { getUnallocatedTotal } from "../../lib/services/evmService";
import { evaluateMetric, DEFAULT_ALERT_RULES } from "../../lib/calc/alerts";

export const dashboardRouter = Router({ mergeParams: true });
dashboardRouter.use(requireAuth, requireProjectScope);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.projectId!;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const { evm, forecast, exposure, profitability, progress } = await computeProjectEvmAndForecast(projectId);
    const unallocated = await getUnallocatedTotal(projectId);

    const cpiStatus = evaluateMetric(evm.cpi, DEFAULT_ALERT_RULES.CPI);
    const spiStatus = evaluateMetric(evm.spi, DEFAULT_ALERT_RULES.SPI);

    const costByCategory = await prisma.actualCostTransaction.groupBy({
      by: ["costCategoryId"],
      where: { projectId, status: "POSTED" },
      _sum: { netAmount: true },
    });
    const categories = await prisma.costCategory.findMany({ where: { projectId } });
    const costByCategoryNamed = costByCategory.map((c) => ({
      costCategoryId: c.costCategoryId,
      name: categories.find((cat) => cat.id === c.costCategoryId)?.name ?? "Uncategorized",
      amount: Number(c._sum.netAmount ?? 0),
    }));

    const costByWorkPackage = await prisma.bOQItem.groupBy({
      by: ["workPackageId"],
      where: { projectId },
      _sum: { totalAmount: true },
    });
    const workPackages = await prisma.workPackage.findMany({ where: { projectId } });
    const costByWorkPackageNamed = costByWorkPackage.map((w) => ({
      workPackageId: w.workPackageId,
      name: workPackages.find((wp) => wp.id === w.workPackageId)?.name ?? "Unassigned",
      budgetAmount: Number(w._sum.totalAmount ?? 0),
    }));

    const alerts = await prisma.alert.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Top cost overruns: BOQ items where actual cost allocated exceeds budget amount.
    const boqItems = await prisma.bOQItem.findMany({
      where: { projectId },
      include: { costAllocations: true },
    });
    const overruns = boqItems
      .map((item) => {
        const actualAllocated = item.costAllocations.reduce((s, a) => s + Number(a.amount), 0);
        return {
          boqItemId: item.id,
          itemNumber: item.itemNumber,
          description: item.description,
          budgetAmount: Number(item.totalAmount),
          actualAmount: round2(actualAllocated),
          overrun: round2(actualAllocated - Number(item.totalAmount)),
          overrunPercent: Number(item.totalAmount) !== 0 ? round2((actualAllocated - Number(item.totalAmount)) / Number(item.totalAmount) * 100) : 0,
        };
      })
      .filter((o) => o.overrun > 0)
      .sort((a, b) => b.overrun - a.overrun)
      .slice(0, 10);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        currency: project.currency,
        currentContractValue: Number(project.currentContractValue) || Number(project.originalContractValue),
      },
      contract: {
        contractValue: Number(project.currentContractValue) || Number(project.originalContractValue),
        currentBudget: evm.bac,
      },
      cost: {
        actualCost: evm.ac,
        committedCost: exposure.remainingCommitment,
        accruedCost: exposure.accruedAmount,
        forecastCost: forecast.eac,
        eac: forecast.eac,
        etc: forecast.etc,
        vac: forecast.vac,
        costExposure: exposure.costExposure,
        unallocatedCost: unallocated,
      },
      progress: {
        plannedPercent: progress.plannedPercent,
        actualPercent: progress.actualPercent,
        variance: round4(progress.actualPercent - progress.plannedPercent),
      },
      performance: {
        cpi: evm.cpi,
        spi: evm.spi,
        cv: evm.cv,
        sv: evm.sv,
        cpiSeverity: cpiStatus.severity,
        spiSeverity: spiStatus.severity,
      },
      profitability,
      costByCategory: costByCategoryNamed,
      costByWorkPackage: costByWorkPackageNamed,
      topOverruns: overruns,
      alerts,
    });
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
