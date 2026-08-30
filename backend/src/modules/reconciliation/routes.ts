import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler } from "../../lib/http";

// Zero-Check / Reconciliation dashboard (spec §58/§59): a battery of data-integrity
// checks so a Cost Control Manager can trust the numbers before reporting them.
export const reconciliationRouter = Router({ mergeParams: true });
reconciliationRouter.use(requireAuth, requireProjectScope);

type CheckStatus = "PASS" | "WARNING" | "ERROR";

interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  count: number;
  message: string;
}

reconciliationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.projectId!;
    const checks: Check[] = [];

    // 1. BOQ items missing a Cost Code
    const boqMissingCostCode = await prisma.bOQItem.count({ where: { projectId, costCodeId: null } });
    checks.push(
      makeCheck("boq_missing_cost_code", "BOQ Items Missing Cost Code", boqMissingCostCode, "BOQ item(s) have no Cost Code assigned.")
    );

    // 2. BOQ items missing WBS
    const boqMissingWbs = await prisma.bOQItem.count({ where: { projectId, wbsId: null } });
    checks.push(makeCheck("boq_missing_wbs", "BOQ Items Missing WBS", boqMissingWbs, "BOQ item(s) have no WBS assigned."));

    // 3. Unallocated actual costs
    const unallocated = await prisma.actualCostTransaction.findMany({ where: { projectId, isUnallocated: true } });
    const unallocatedTotal = unallocated.reduce((s, t) => s + Number(t.netAmount), 0);
    checks.push({
      key: "unallocated_cost",
      label: "Unallocated Costs",
      status: unallocated.length === 0 ? "PASS" : unallocated.length > 5 ? "ERROR" : "WARNING",
      count: unallocated.length,
      message:
        unallocated.length === 0
          ? "All actual costs are coded."
          : `${unallocated.length} transaction(s) totalling ${unallocatedTotal.toLocaleString()} awaiting cost coding.`,
    });

    // 4. Current Budget total vs sum of BOQ items (should reconcile when the budget was generated from the BOQ)
    const latestBudget = await prisma.budget.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
    let budgetVsBoq: Check;
    if (!latestBudget) {
      budgetVsBoq = { key: "budget_vs_boq", label: "Budget Total vs BOQ Total", status: "WARNING", count: 0, message: "No budget has been generated yet." };
    } else {
      const budgetAgg = await prisma.budgetLine.aggregate({ where: { budgetId: latestBudget.id }, _sum: { budgetAmount: true } });
      const boqAgg = await prisma.bOQItem.aggregate({ where: { projectId }, _sum: { totalAmount: true } });
      const budgetTotal = Number(budgetAgg._sum.budgetAmount ?? 0);
      const boqTotal = Number(boqAgg._sum.totalAmount ?? 0);
      const diff = round2(budgetTotal - boqTotal);
      budgetVsBoq = {
        key: "budget_vs_boq",
        label: "Budget Total vs BOQ Total",
        status: Math.abs(diff) < 1 ? "PASS" : "WARNING",
        count: Math.abs(diff) < 1 ? 0 : 1,
        message:
          Math.abs(diff) < 1
            ? "Latest budget total matches the BOQ total."
            : `Latest budget (${budgetTotal.toLocaleString()}) differs from current BOQ total (${boqTotal.toLocaleString()}) by ${diff.toLocaleString()} — BOQ has changed since this budget version was generated.`,
      };
    }
    checks.push(budgetVsBoq);

    // 5. Negative material balances (issued+consumed exceeding received+returned)
    const materials = await prisma.material.findMany({
      where: { projectId },
      include: { receipts: true, issues: true, returns: true },
    });
    const negativeBalanceMaterials = materials.filter((m) => {
      const received = m.receipts.reduce((s, r) => s + Number(r.quantity), 0);
      const issued = m.issues.reduce((s, i) => s + Number(i.quantity), 0);
      const returned = m.returns.reduce((s, r) => s + Number(r.quantity), 0);
      return received - issued + returned < -0.001;
    });
    checks.push(
      makeCheck(
        "negative_material_balance",
        "Materials With Negative Balance",
        negativeBalanceMaterials.length,
        "material(s) show more issued than received — check receipt/issue entries.",
        negativeBalanceMaterials.map((m) => m.code)
      )
    );

    // 6. Commitments certified beyond revised value
    const commitments = await prisma.commitment.findMany({ where: { projectId } });
    const overCertifiedCommitments = commitments.filter(
      (c) => Number(c.certifiedAmount) > Number(c.originalAmount) + Number(c.approvedVariations) + 0.01
    );
    checks.push(
      makeCheck(
        "over_certified_commitments",
        "Commitments Certified Beyond Revised Value",
        overCertifiedCommitments.length,
        "commitment(s) have certified amounts exceeding their revised value.",
        overCertifiedCommitments.map((c) => c.number)
      )
    );

    // 7. Subcontracts certified beyond revised value
    const subcontracts = await prisma.subcontract.findMany({ where: { projectId }, include: { certificates: true } });
    const overCertifiedSubcontracts = subcontracts.filter((sc) => {
      const lastCert = sc.certificates[sc.certificates.length - 1];
      const certified = lastCert ? Number(lastCert.cumulativeWorkDone) : 0;
      return certified > Number(sc.revisedValue) + 0.01;
    });
    checks.push(
      makeCheck(
        "over_certified_subcontracts",
        "Subcontracts Certified Beyond Revised Value",
        overCertifiedSubcontracts.length,
        "subcontract(s) have cumulative certified work exceeding their revised contract value.",
        overCertifiedSubcontracts.map((s) => s.contractNumber)
      )
    );

    // 8. Negative accruals (invoiced more than work done — should have been reversed, not accrued)
    const negativeAccruals = await prisma.accrual.count({ where: { projectId, accruedAmount: { lt: 0 } } });
    checks.push(makeCheck("negative_accruals", "Accruals With Negative Balance", negativeAccruals, "accrual(s) show invoiced amount exceeding work done."));

    // 9. Cost codes referenced by transactions but inactive
    const inactiveCodesInUse = await prisma.costCode.findMany({
      where: { projectId, isActive: false, actualCosts: { some: {} } },
    });
    checks.push(
      makeCheck(
        "inactive_cost_codes_in_use",
        "Inactive Cost Codes Still Posted Against",
        inactiveCodesInUse.length,
        "inactive cost code(s) have posted transactions — reactivate or re-code them.",
        inactiveCodesInUse.map((c) => c.code)
      )
    );

    const errorCount = checks.filter((c) => c.status === "ERROR").length;
    const warningCount = checks.filter((c) => c.status === "WARNING").length;
    const overallStatus: CheckStatus = errorCount > 0 ? "ERROR" : warningCount > 0 ? "WARNING" : "PASS";

    res.json({ checks, overallStatus, errorCount, warningCount, passCount: checks.length - errorCount - warningCount });
  })
);

function makeCheck(key: string, label: string, count: number, messageSuffix: string, sample?: string[]): Check {
  const sampleText = sample && sample.length > 0 ? ` (${sample.slice(0, 5).join(", ")}${sample.length > 5 ? ", ..." : ""})` : "";
  return {
    key,
    label,
    status: count === 0 ? "PASS" : count > 5 ? "ERROR" : "WARNING",
    count,
    message: count === 0 ? `No issues found.` : `${count} ${messageSuffix}${sampleText}`,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
