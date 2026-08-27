import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody, HttpError } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

// Central Approval Center (spec §77): a single place to see and act on every
// pending Cost, Budget change, Variation, Accrual, and Payment Certificate
// awaiting sign-off, instead of hunting through each module individually.
export const approvalsRouter = Router({ mergeParams: true });
approvalsRouter.use(requireAuth, requireProjectScope);

approvalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.projectId!;

    const [actualCosts, budgets, variations, accruals, paymentCertificates] = await Promise.all([
      prisma.actualCostTransaction.findMany({
        where: { projectId, status: { in: ["SUBMITTED", "REVIEWED"] } },
        include: { costCode: true, wbs: true },
        orderBy: { date: "desc" },
      }),
      prisma.budget.findMany({
        where: { projectId, status: "DRAFT" },
        include: { _count: { select: { lines: true } } },
        orderBy: { version: "desc" },
      }),
      prisma.variation.findMany({
        where: { projectId, status: { in: ["DRAFT", "SUBMITTED"] } },
        orderBy: { number: "asc" },
      }),
      prisma.accrual.findMany({
        where: { projectId, status: { in: ["DRAFT", "SUBMITTED"] } },
        include: { costCode: true },
        orderBy: { periodDate: "desc" },
      }),
      prisma.paymentCertificate.findMany({
        where: { status: { in: ["DRAFT", "SUBMITTED"] }, subcontract: { projectId } },
        include: { subcontract: { include: { subcontractor: true } } },
        orderBy: { periodDate: "desc" },
      }),
    ]);

    res.json({
      actualCosts,
      budgets,
      variations,
      accruals,
      paymentCertificates,
      totalPending: actualCosts.length + budgets.length + variations.length + accruals.length + paymentCertificates.length,
    });
  })
);

const actionSchema = z.object({ reason: z.string().optional() });
const rejectSchema = z.object({ reason: z.string().min(1, "A reason is required to reject or return an item") });

type ApprovalType = "actual-cost" | "budget" | "variation" | "accrual" | "payment-certificate";

async function loadEntity(type: ApprovalType, id: string, projectId: string) {
  switch (type) {
    case "actual-cost":
      return prisma.actualCostTransaction.findFirst({ where: { id, projectId } });
    case "budget":
      return prisma.budget.findFirst({ where: { id, projectId } });
    case "variation":
      return prisma.variation.findFirst({ where: { id, projectId } });
    case "accrual":
      return prisma.accrual.findFirst({ where: { id, projectId } });
    case "payment-certificate":
      return prisma.paymentCertificate.findFirst({ where: { id, subcontract: { projectId } } });
  }
}

const ENTITY_LABEL: Record<ApprovalType, string> = {
  "actual-cost": "ActualCostTransaction",
  budget: "Budget",
  variation: "Variation",
  accrual: "Accrual",
  "payment-certificate": "PaymentCertificate",
};

approvalsRouter.post(
  "/:type/:id/approve",
  requirePermission("approvals", "approve"),
  validateBody(actionSchema),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ApprovalType;
    const existing = await loadEntity(type, req.params.id, req.projectId!);
    if (!existing) return res.status(404).json({ error: "Item not found or not pending approval" });

    let updated;
    switch (type) {
      case "actual-cost":
        updated = await prisma.actualCostTransaction.update({ where: { id: existing.id }, data: { status: "APPROVED" } });
        break;
      case "budget":
        await prisma.budget.updateMany({ where: { projectId: req.projectId, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
        updated = await prisma.budget.update({ where: { id: existing.id }, data: { status: "APPROVED", approvedAt: new Date() } });
        break;
      case "variation":
        updated = await prisma.variation.update({ where: { id: existing.id }, data: { status: "APPROVED", approvedAt: new Date() } });
        break;
      case "accrual":
        updated = await prisma.accrual.update({ where: { id: existing.id }, data: { status: "APPROVED" } });
        break;
      case "payment-certificate":
        updated = await prisma.paymentCertificate.update({ where: { id: existing.id }, data: { status: "CERTIFIED" } });
        break;
      default:
        throw new HttpError(400, "Unknown approval type");
    }

    await writeAudit({
      userId: req.user!.id,
      entityType: ENTITY_LABEL[type],
      entityId: existing.id,
      action: "APPROVE",
      oldValue: existing,
      newValue: updated,
      reason: req.body.reason,
    });
    res.json(updated);
  })
);

approvalsRouter.post(
  "/:type/:id/reject",
  requirePermission("approvals", "approve"),
  validateBody(rejectSchema),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ApprovalType;
    const existing = await loadEntity(type, req.params.id, req.projectId!);
    if (!existing) return res.status(404).json({ error: "Item not found or not pending approval" });

    let updated;
    switch (type) {
      case "variation":
        updated = await prisma.variation.update({ where: { id: existing.id }, data: { status: "REJECTED" } });
        break;
      case "actual-cost":
      case "accrual":
        // No terminal "rejected" state on these transaction models — a reject
        // sends it back to Draft for correction, same as "Return for Correction".
        updated = await (type === "actual-cost"
          ? prisma.actualCostTransaction.update({ where: { id: existing.id }, data: { status: "DRAFT" } })
          : prisma.accrual.update({ where: { id: existing.id }, data: { status: "DRAFT" } }));
        break;
      case "payment-certificate":
        updated = await prisma.paymentCertificate.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
        break;
      case "budget":
        // A budget draft has no separate "rejected" state; log the rejection reason and leave it in Draft.
        updated = existing;
        break;
      default:
        throw new HttpError(400, "Unknown approval type");
    }

    await writeAudit({
      userId: req.user!.id,
      entityType: ENTITY_LABEL[type],
      entityId: existing.id,
      action: "REJECT",
      oldValue: existing,
      newValue: updated,
      reason: req.body.reason,
    });
    res.json(updated);
  })
);

approvalsRouter.post(
  "/:type/:id/return",
  requirePermission("approvals", "approve"),
  validateBody(rejectSchema),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ApprovalType;
    const existing = await loadEntity(type, req.params.id, req.projectId!);
    if (!existing) return res.status(404).json({ error: "Item not found or not pending approval" });

    let updated;
    switch (type) {
      case "actual-cost":
        updated = await prisma.actualCostTransaction.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
        break;
      case "accrual":
        updated = await prisma.accrual.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
        break;
      case "payment-certificate":
        updated = await prisma.paymentCertificate.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
        break;
      case "variation":
        updated = await prisma.variation.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
        break;
      case "budget":
        updated = existing;
        break;
      default:
        throw new HttpError(400, "Unknown approval type");
    }

    await writeAudit({
      userId: req.user!.id,
      entityType: ENTITY_LABEL[type],
      entityId: existing.id,
      action: "RETURN_FOR_CORRECTION",
      oldValue: existing,
      newValue: updated,
      reason: req.body.reason,
    });
    res.json(updated);
  })
);
