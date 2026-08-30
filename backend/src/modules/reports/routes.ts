import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { computeQtyRateVariance } from "../../lib/calc/variance";
import { buildExcelReport } from "../../lib/excelExport";
import { buildPdfReport } from "../../lib/pdfReport";
import { computeProjectEvmAndForecast } from "../evm/routes";

export const reportsRouter = Router({ mergeParams: true });
reportsRouter.use(requireAuth, requireProjectScope);

// ── BOQ Quantity vs Rate Analysis ─────────────────────────────────────
reportsRouter.get(
  "/boq-variance",
  asyncHandler(async (req, res) => {
    const items = await prisma.bOQItem.findMany({
      where: { projectId: req.projectId },
      include: { costAllocations: true },
    });
    const rows = items.map((item) => {
      const actualAmount = item.costAllocations.reduce((s, a) => s + Number(a.amount), 0);
      // Without a direct per-item actual-quantity ledger, approximate actual quantity via actual/budget rate ratio.
      const actualQuantity = Number(item.unitRate) !== 0 ? actualAmount / Number(item.unitRate) : 0;
      const variance = computeQtyRateVariance({
        budgetQuantity: Number(item.quantity),
        budgetRate: Number(item.unitRate),
        actualQuantity,
        actualRate: Number(item.unitRate),
      });
      return { itemNumber: item.itemNumber, description: item.description, unit: item.unit, ...variance };
    });
    res.json(rows);
  })
);

// ── Cost Code Analysis (Budget vs Actual vs Forecast) ─────────────────
reportsRouter.get(
  "/cost-code-analysis",
  asyncHandler(async (req, res) => {
    const costCodes = await prisma.costCode.findMany({ where: { projectId: req.projectId } });
    const rows = await Promise.all(
      costCodes.map(async (cc) => {
        const budgetAgg = await prisma.budgetLine.aggregate({ where: { costCodeId: cc.id }, _sum: { budgetAmount: true } });
        const actualAgg = await prisma.actualCostTransaction.aggregate({
          where: { costCodeId: cc.id, status: "POSTED" },
          _sum: { netAmount: true },
        });
        const budget = Number(budgetAgg._sum.budgetAmount ?? 0);
        const actual = Number(actualAgg._sum.netAmount ?? 0);
        return {
          costCodeId: cc.id,
          code: cc.code,
          description: cc.description,
          budget,
          actual,
          variance: round2(budget - actual),
          variancePercent: budget !== 0 ? round2(((budget - actual) / budget) * 100) : 0,
        };
      })
    );
    res.json(rows.sort((a, b) => a.variance - b.variance));
  })
);

// ── Unallocated Cost Report ─────────────────────────────────────────────
reportsRouter.get(
  "/unallocated",
  asyncHandler(async (req, res) => {
    const items = await prisma.actualCostTransaction.findMany({
      where: { projectId: req.projectId, isUnallocated: true },
      orderBy: { date: "desc" },
    });
    res.json({ items, total: round2(items.reduce((s, i) => s + Number(i.netAmount), 0)) });
  })
);

// ── Material Loss / Waste Report ────────────────────────────────────────
reportsRouter.get(
  "/material-loss",
  asyncHandler(async (req, res) => {
    const materials = await prisma.material.findMany({
      where: { projectId: req.projectId },
      include: { losses: true },
    });
    const rows = materials.map((m) => ({
      code: m.code,
      description: m.description,
      allowedWastePercent: Number(m.allowedWastePercent),
      totalLossQuantity: round4(m.losses.reduce((s, l) => s + Number(l.lossQuantity), 0)),
      totalLossCost: round2(m.losses.reduce((s, l) => s + Number(l.lossCost), 0)),
      overAllowedEvents: m.losses.filter((l) => Number(l.actualWastePercent) > Number(m.allowedWastePercent)).length,
    }));
    res.json(rows);
  })
);

// ── Subcontractor Cost Report ───────────────────────────────────────────
reportsRouter.get(
  "/subcontractors",
  asyncHandler(async (req, res) => {
    const subs = await prisma.subcontractor.findMany({
      where: { projectId: req.projectId },
      include: { subcontracts: { include: { certificates: true } } },
    });
    const rows = subs.flatMap((s) =>
      s.subcontracts.map((sc) => {
        const revised = Number(sc.originalValue) + Number(sc.approvedVariations);
        const lastCert = sc.certificates[sc.certificates.length - 1];
        const certified = lastCert ? Number(lastCert.cumulativeWorkDone) : 0;
        return {
          companyName: s.companyName,
          contractNumber: sc.contractNumber,
          originalValue: Number(sc.originalValue),
          revisedValue: revised,
          certifiedAmount: certified,
          remainingCommitment: round2(revised - certified),
        };
      })
    );
    res.json(rows);
  })
);

// ── Taxes & Overhead Report ──────────────────────────────────────────────
reportsRouter.get(
  "/taxes-overhead",
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: req.projectId } });
    const vatAgg = await prisma.actualCostTransaction.aggregate({
      where: { projectId: req.projectId, status: "POSTED" },
      _sum: { netAmount: true, vatAmount: true, grossAmount: true },
    });
    const netCost = Number(vatAgg._sum.netAmount ?? 0);
    const vatAmount = Number(vatAgg._sum.vatAmount ?? 0);
    const grossCost = Number(vatAgg._sum.grossAmount ?? 0);

    const headOfficeOverheadPercent = Number(project.headOfficeOverheadPercent);
    const insuranceRate = Number(project.insuranceRate);
    const provisionRate = Number(project.provisionRate);

    const headOfficeOverhead = round2((netCost * headOfficeOverheadPercent) / 100);
    const insurance = round2((netCost * insuranceRate) / 100);
    const provision = round2((netCost * provisionRate) / 100);

    res.json({
      vatRate: Number(project.vatRate),
      netCost,
      vatAmount,
      grossCost,
      headOfficeOverheadPercent,
      headOfficeOverhead,
      insuranceRate,
      insurance,
      provisionRate,
      provision,
      totalTaxesAndOverhead: round2(vatAmount + headOfficeOverhead + insurance + provision),
    });
  })
);

// ── Manpower Cost Report ─────────────────────────────────────────────────
reportsRouter.get(
  "/manpower",
  asyncHandler(async (req, res) => {
    const entries = await prisma.manpowerEntry.groupBy({
      by: ["category"],
      where: { projectId: req.projectId },
      _sum: { totalCost: true, headcount: true },
    });
    res.json(
      entries.map((e) => ({
        category: e.category,
        headcount: Number(e._sum.headcount ?? 0),
        totalCost: Number(e._sum.totalCost ?? 0),
      }))
    );
  })
);

// ── Equipment Cost Report ────────────────────────────────────────────────
reportsRouter.get(
  "/equipment",
  asyncHandler(async (req, res) => {
    const entries = await prisma.equipmentEntry.groupBy({
      by: ["equipmentName", "ownership"],
      where: { projectId: req.projectId },
      _sum: { totalCost: true, operatingHours: true },
    });
    res.json(
      entries.map((e) => ({
        equipmentName: e.equipmentName,
        ownership: e.ownership,
        operatingHours: Number(e._sum.operatingHours ?? 0),
        totalCost: Number(e._sum.totalCost ?? 0),
      }))
    );
  })
);

// ── Commitment Report ─────────────────────────────────────────────────────
reportsRouter.get(
  "/commitments",
  asyncHandler(async (req, res) => {
    const commitments = await prisma.commitment.findMany({ where: { projectId: req.projectId } });
    res.json(
      commitments.map((c) => {
        const revised = Number(c.originalAmount) + Number(c.approvedVariations);
        return {
          number: c.number,
          type: c.type,
          vendorName: c.vendorName,
          originalAmount: Number(c.originalAmount),
          revisedAmount: round2(revised),
          certifiedAmount: Number(c.certifiedAmount),
          remaining: round2(revised - Number(c.certifiedAmount)),
          status: c.status,
        };
      })
    );
  })
);

// ── Indirect Cost Report ─────────────────────────────────────────────────
reportsRouter.get(
  "/indirect-costs",
  asyncHandler(async (req, res) => {
    const entries = await prisma.indirectCostEntry.groupBy({
      by: ["category"],
      where: { projectId: req.projectId },
      _sum: { amount: true },
    });
    res.json(entries.map((e) => ({ category: e.category, amount: Number(e._sum.amount ?? 0) })));
  })
);

// ── Executive Cost Report (Excel) ───────────────────────────────────────
reportsRouter.get(
  "/executive/excel",
  requirePermission("reports", "export"),
  asyncHandler(async (req, res) => {
    const { evm, forecast, exposure, profitability } = await computeProjectEvmAndForecast(req.projectId!);
    const buffer = await buildExcelReport(
      "Executive Cost Report",
      [
        { header: "Metric", key: "metric", width: 30 },
        { header: "Value", key: "value", width: 20, numFmt: "#,##0.00" },
      ],
      [
        { metric: "Current Budget (BAC)", value: evm.bac },
        { metric: "Actual Cost (AC)", value: evm.ac },
        { metric: "Committed (Remaining)", value: exposure.remainingCommitment },
        { metric: "Accrued", value: exposure.accruedAmount },
        { metric: "Cost Exposure", value: exposure.costExposure },
        { metric: "Earned Value (EV)", value: evm.ev },
        { metric: "Planned Value (PV)", value: evm.pv },
        { metric: "CPI", value: evm.cpi },
        { metric: "SPI", value: evm.spi },
        { metric: "ETC", value: forecast.etc },
        { metric: "EAC", value: forecast.eac },
        { metric: "VAC", value: forecast.vac },
        { metric: "Forecast Profit", value: profitability.forecastProfit },
        { metric: "Forecast Margin %", value: profitability.forecastMarginPercent },
      ]
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Executive-Cost-Report.xlsx");
    res.send(buffer);
  })
);

// ── Executive Cost Report (PDF) ─────────────────────────────────────────
reportsRouter.get(
  "/executive/pdf",
  requirePermission("reports", "print"),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: req.projectId } });
    const { evm, forecast, exposure, profitability } = await computeProjectEvmAndForecast(req.projectId!);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });

    const buffer = await buildPdfReport({
      companyName: company.name,
      companyLogoDataUri: company.logoUrl,
      projectName: project.name,
      reportTitle: "Executive Cost Report",
      reportingDate: new Date().toISOString().slice(0, 10),
      preparedBy: req.user!.fullName,
      executiveSummary: `Project is tracking at CPI ${evm.cpi} and SPI ${evm.spi}. Forecast final cost (EAC) is ${project.currency} ${forecast.eac.toLocaleString()} against a current budget of ${project.currency} ${evm.bac.toLocaleString()}, a variance at completion (VAC) of ${project.currency} ${forecast.vac.toLocaleString()}.`,
      kpis: [
        { label: "Current Budget", value: fmt(evm.bac, project.currency) },
        { label: "Actual Cost", value: fmt(evm.ac, project.currency) },
        { label: "Committed", value: fmt(exposure.remainingCommitment, project.currency) },
        { label: "Accrued", value: fmt(exposure.accruedAmount, project.currency) },
        { label: "EAC", value: fmt(forecast.eac, project.currency) },
        { label: "VAC", value: fmt(forecast.vac, project.currency) },
        { label: "CPI", value: String(evm.cpi) },
        { label: "SPI", value: String(evm.spi) },
        { label: "Forecast Profit", value: fmt(profitability.forecastProfit, project.currency) },
        { label: "Forecast Margin", value: `${profitability.forecastMarginPercent}%` },
      ],
      tableColumns: [
        { key: "metric", header: "Metric", width: 260 },
        { key: "value", header: "Value", width: 160 },
      ],
      tableRows: [
        { metric: "Planned Value (PV)", value: fmt(evm.pv, project.currency) },
        { metric: "Earned Value (EV)", value: fmt(evm.ev, project.currency) },
        { metric: "Cost Variance (CV)", value: fmt(evm.cv, project.currency) },
        { metric: "Schedule Variance (SV)", value: fmt(evm.sv, project.currency) },
        { metric: "Estimate to Complete (ETC)", value: fmt(forecast.etc, project.currency) },
      ],
      notes: "Generated by the Construction Project Cost Control & Management System.",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Executive-Cost-Report.pdf");
    res.send(buffer);
  })
);

// ── Reporting Periods / Snapshots ───────────────────────────────────────
reportsRouter.get(
  "/periods",
  asyncHandler(async (req, res) => {
    const periods = await prisma.reportingPeriod.findMany({ where: { projectId: req.projectId }, orderBy: { cutoffDate: "desc" } });
    res.json(periods);
  })
);

const periodSchema = z.object({ periodLabel: z.string().min(1), cutoffDate: z.string().datetime() });

reportsRouter.post(
  "/periods",
  requirePermission("reports", "create"),
  validateBody(periodSchema),
  asyncHandler(async (req, res) => {
    const period = await prisma.reportingPeriod.create({ data: { ...req.body, projectId: req.projectId! } });
    res.status(201).json(period);
  })
);

// Finalizing a period freezes the current KPI computation into an immutable snapshot.
reportsRouter.post(
  "/periods/:id/finalize",
  requirePermission("reports", "approve"),
  asyncHandler(async (req, res) => {
    const period = await prisma.reportingPeriod.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!period) return res.status(404).json({ error: "Reporting period not found" });
    if (period.status === "FINALIZED") return res.status(400).json({ error: "Period already finalized; snapshots are immutable" });

    const payload = await computeProjectEvmAndForecast(req.projectId!);
    await prisma.reportSnapshot.create({
      data: { reportingPeriodId: period.id, reportType: "EXECUTIVE", payloadJson: payload as any },
    });
    const updated = await prisma.reportingPeriod.update({
      where: { id: period.id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
    res.json(updated);
  })
);

reportsRouter.get(
  "/periods/:id/snapshots",
  asyncHandler(async (req, res) => {
    const snapshots = await prisma.reportSnapshot.findMany({ where: { reportingPeriodId: req.params.id } });
    res.json(snapshots);
  })
);

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
