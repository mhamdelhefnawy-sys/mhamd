import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { computeEVM } from "../../lib/calc/evm";
import { computeForecast, EacFormula } from "../../lib/calc/forecast";
import { computeCostExposure } from "../../lib/calc/costExposure";
import { computeProfitability } from "../../lib/calc/profitability";
import {
  getCurrentBudgetTotal,
  getActualCostTotal,
  getCommittedRemaining,
  getAccruedTotal,
  getProjectProgress,
} from "../../lib/services/evmService";

export const evmRouter = Router({ mergeParams: true });
evmRouter.use(requireAuth, requireProjectScope);

evmRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await computeProjectEvmAndForecast(req.projectId!);
    res.json(result);
  })
);

export async function computeProjectEvmAndForecast(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const bac = await getCurrentBudgetTotal(projectId);
  const ac = await getActualCostTotal(projectId);
  const progress = await getProjectProgress(projectId);

  const evm = computeEVM({ bac, plannedPercent: progress.plannedPercent, actualPercent: progress.actualPercent, actualCost: ac });
  const forecast = computeForecast({ bac, ac, ev: evm.ev, cpi: evm.cpi, formula: project.eacFormula as EacFormula });

  const committedRemaining = await getCommittedRemaining(projectId);
  const accrued = await getAccruedTotal(projectId);
  const exposure = computeCostExposure({
    actualCost: ac,
    committedTotal: committedRemaining + ac, // approximation: remaining + already-actualized portion
    committedInvoicedOrActualized: ac,
    accruedAmount: accrued,
  });

  const profitability = computeProfitability({
    currentContractValue: Number(project.currentContractValue) || Number(project.originalContractValue),
    forecastCost: forecast.eac,
    budgetCost: bac,
  });

  return { evm, forecast, exposure, profitability, progress };
}

// Manual forecast / ETC override (logged to audit per §30/§31).
const forecastOverrideSchema = z.object({
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  scenario: z.enum(["MOST_LIKELY", "OPTIMISTIC", "WORST_CASE"]).default("MOST_LIKELY"),
  manualETC: z.number().nullable().optional(),
  manualForecastCost: z.number().nullable().optional(),
  forecastRate: z.number().nullable().optional(),
  overrideReason: z.string().min(1),
});

evmRouter.post(
  "/forecast-override",
  requirePermission("forecast", "edit"),
  validateBody(forecastOverrideSchema),
  asyncHandler(async (req, res) => {
    const entry = await prisma.forecastEntry.create({
      data: {
        ...req.body,
        projectId: req.projectId!,
        isManualOverride: true,
        createdById: req.user!.id,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      entityType: "ForecastEntry",
      entityId: entry.id,
      action: "OVERRIDE",
      newValue: entry,
      reason: req.body.overrideReason,
    });
    res.status(201).json(entry);
  })
);

evmRouter.get(
  "/forecast-overrides",
  asyncHandler(async (req, res) => {
    const items = await prisma.forecastEntry.findMany({ where: { projectId: req.projectId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  })
);

// Snapshot: freezes today's EVM values into an EVMSnapshot row for trend charting.
evmRouter.post(
  "/snapshot",
  requirePermission("evm", "post"),
  asyncHandler(async (req, res) => {
    const { evm, forecast } = await computeProjectEvmAndForecast(req.projectId!);
    const snapshot = await prisma.eVMSnapshot.create({
      data: {
        projectId: req.projectId!,
        asOfDate: new Date(),
        scope: "PROJECT",
        bac: evm.bac,
        pv: evm.pv,
        ev: evm.ev,
        ac: evm.ac,
        cv: evm.cv,
        sv: evm.sv,
        cpi: evm.cpi,
        spi: evm.spi,
        etc: forecast.etc,
        eac: forecast.eac,
        vac: forecast.vac,
        tcpi: evm.tcpi,
      },
    });
    res.status(201).json(snapshot);
  })
);

// Forecast Scenarios (spec §66): Current/Most Likely, Optimistic, Worst Case — each
// with its own ETC/EAC/VAC/Profit/Margin. Uses the latest project-level manual
// override for that scenario when one exists; otherwise applies a heuristic
// variance band around the system-calculated ETC so the three scenarios are
// always populated, clearly labeled as heuristic until a user overrides them.
const SCENARIOS = ["MOST_LIKELY", "OPTIMISTIC", "WORST_CASE"] as const;
const HEURISTIC_MULTIPLIER: Record<(typeof SCENARIOS)[number], number> = {
  MOST_LIKELY: 1,
  OPTIMISTIC: 0.9,
  WORST_CASE: 1.15,
};

evmRouter.get(
  "/scenarios",
  asyncHandler(async (req, res) => {
    const projectId = req.projectId!;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const bac = await getCurrentBudgetTotal(projectId);
    const ac = await getActualCostTotal(projectId);
    const progress = await getProjectProgress(projectId);
    const evm = computeEVM({ bac, plannedPercent: progress.plannedPercent, actualPercent: progress.actualPercent, actualCost: ac });
    const baseForecast = computeForecast({ bac, ac, ev: evm.ev, cpi: evm.cpi, formula: project.eacFormula as EacFormula });
    const revenue = Number(project.currentContractValue) || Number(project.originalContractValue);

    const results: Record<string, unknown> = {};
    for (const scenario of SCENARIOS) {
      const override = await prisma.forecastEntry.findFirst({
        where: { projectId, scenario, wbsId: null, boqItemId: null, costCodeId: null, isManualOverride: true },
        orderBy: { createdAt: "desc" },
      });

      const etc = override?.manualETC != null ? Number(override.manualETC) : round2(baseForecast.etc * HEURISTIC_MULTIPLIER[scenario]);
      const eac = round2(ac + etc);
      const vac = round2(bac - eac);
      const profitability = computeProfitability({ currentContractValue: revenue, forecastCost: eac, budgetCost: bac });

      results[scenarioKey(scenario)] = {
        scenario,
        etc,
        eac,
        vac,
        forecastProfit: profitability.forecastProfit,
        forecastMarginPercent: profitability.forecastMarginPercent,
        isManualOverride: !!override,
        overrideReason: override?.overrideReason ?? null,
      };
    }

    res.json(results);
  })
);

function scenarioKey(s: (typeof SCENARIOS)[number]) {
  return s === "MOST_LIKELY" ? "mostLikely" : s === "OPTIMISTIC" ? "optimistic" : "worstCase";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

evmRouter.get(
  "/trend",
  asyncHandler(async (req, res) => {
    const snapshots = await prisma.eVMSnapshot.findMany({
      where: { projectId: req.projectId, scope: "PROJECT" },
      orderBy: { asOfDate: "asc" },
    });
    res.json(snapshots);
  })
);
