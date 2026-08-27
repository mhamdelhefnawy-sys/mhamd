import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const commitmentsRouter = Router({ mergeParams: true });
commitmentsRouter.use(requireAuth, requireProjectScope);

commitmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.commitment.findMany({
      where: { projectId: req.projectId },
      include: { lines: true, wbs: true, boqItem: true, costCode: true },
      orderBy: { number: "asc" },
    });
    res.json(
      items.map((c) => {
        const revised = Number(c.originalAmount) + Number(c.approvedVariations);
        return { ...c, revisedAmount: round2(revised), remaining: round2(revised - Number(c.certifiedAmount)) };
      })
    );
  })
);

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().optional(),
  unitRate: z.number().nullable().optional(),
  amount: z.number(),
});

const commitmentSchema = z.object({
  type: z.enum(["PURCHASE_ORDER", "SUBCONTRACT", "MATERIAL_ORDER", "EQUIPMENT_CONTRACT", "SERVICE_ORDER"]),
  number: z.string().min(1),
  vendorName: z.string().min(1),
  subcontractId: z.string().nullable().optional(),
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  originalAmount: z.number(),
  lines: z.array(lineSchema).default([]),
});

commitmentsRouter.post(
  "/",
  requirePermission("commitments", "create"),
  validateBody(commitmentSchema),
  asyncHandler(async (req, res) => {
    const { lines, ...rest } = req.body;
    const item = await prisma.commitment.create({
      data: { ...rest, projectId: req.projectId!, status: "DRAFT", lines: { create: lines } },
      include: { lines: true },
    });
    await writeAudit({ userId: req.user!.id, entityType: "Commitment", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

const updateSchema = z.object({
  approvedVariations: z.number().optional(),
  certifiedAmount: z.number().optional(),
  paidAmount: z.number().optional(),
  forecastFinalCost: z.number().nullable().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED", "APPROVED", "POSTED"]).optional(),
});

commitmentsRouter.put(
  "/:id",
  requirePermission("commitments", "edit"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.commitment.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "Commitment not found" });
    const updated = await prisma.commitment.update({ where: { id: existing.id }, data: req.body });
    await writeAudit({ userId: req.user!.id, entityType: "Commitment", entityId: updated.id, action: "UPDATE", oldValue: existing, newValue: updated });
    res.json(updated);
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ── Accruals ────────────────────────────────────────────────────────────
export const accrualsRouter = Router({ mergeParams: true });
accrualsRouter.use(requireAuth, requireProjectScope);

accrualsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.accrual.findMany({
      where: { projectId: req.projectId },
      include: { wbs: true, boqItem: true, costCode: true },
      orderBy: { periodDate: "desc" },
    });
    res.json(items);
  })
);

const accrualSchema = z.object({
  periodDate: z.string().datetime(),
  description: z.string().min(1),
  workDoneAmount: z.number(),
  invoicedAmount: z.number().default(0),
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
});

accrualsRouter.post(
  "/",
  requirePermission("accruals", "create"),
  validateBody(accrualSchema),
  asyncHandler(async (req, res) => {
    const accruedAmount = round2(req.body.workDoneAmount - req.body.invoicedAmount);
    const item = await prisma.accrual.create({
      data: { ...req.body, accruedAmount, projectId: req.projectId!, status: "DRAFT" },
    });
    await writeAudit({ userId: req.user!.id, entityType: "Accrual", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);
