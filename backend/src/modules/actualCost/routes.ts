import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { validateAllocation, computeAllocationAmounts } from "../../lib/calc/allocation";

export const actualCostRouter = Router({ mergeParams: true });
actualCostRouter.use(requireAuth, requireProjectScope);

actualCostRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { unallocatedOnly, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const where = {
      projectId: req.projectId,
      ...(unallocatedOnly === "true" ? { isUnallocated: true } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.actualCostTransaction.findMany({
        where,
        include: { wbs: true, boqItem: true, costCode: true, costCategory: true, allocations: true },
        orderBy: { date: "desc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.actualCostTransaction.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  })
);

const allocationLineSchema = z.object({
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  costCategoryId: z.string().nullable().optional(),
  percentage: z.number(),
});

const actualCostSchema = z.object({
  date: z.string().datetime(),
  documentNumber: z.string().optional(),
  supplier: z.string().optional(),
  subcontractorId: z.string().nullable().optional(),
  employeeName: z.string().optional(),
  materialId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().optional(),
  unitRate: z.number().nullable().optional(),
  netAmount: z.number(),
  vatAmount: z.number().default(0),
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  costCategoryId: z.string().nullable().optional(),
  currency: z.string().default("SAR"),
  exchangeRate: z.number().default(1),
  reference: z.string().optional(),
  allocations: z.array(allocationLineSchema).optional(), // if provided, must total 100%
});

actualCostRouter.post(
  "/",
  requirePermission("actual_cost", "create"),
  validateBody(actualCostSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof actualCostSchema>;
    const grossAmount = round2(body.netAmount + body.vatAmount);
    const isUnallocated = !body.costCodeId && (!body.allocations || body.allocations.length === 0);

    let allocationsToCreate: ReturnType<typeof computeAllocationAmounts> = [];
    if (body.allocations && body.allocations.length > 0) {
      validateAllocation(body.allocations);
      allocationsToCreate = computeAllocationAmounts(body.netAmount, body.allocations);
    }

    const tx = await prisma.actualCostTransaction.create({
      data: {
        projectId: req.projectId!,
        date: body.date,
        documentNumber: body.documentNumber,
        supplier: body.supplier,
        subcontractorId: body.subcontractorId,
        employeeName: body.employeeName,
        materialId: body.materialId,
        description: body.description,
        quantity: body.quantity,
        unit: body.unit,
        unitRate: body.unitRate,
        netAmount: body.netAmount,
        vatAmount: body.vatAmount,
        grossAmount,
        wbsId: body.wbsId,
        boqItemId: body.boqItemId,
        costCodeId: body.costCodeId,
        costCategoryId: body.costCategoryId,
        currency: body.currency,
        exchangeRate: body.exchangeRate,
        reference: body.reference,
        status: "DRAFT",
        isUnallocated,
        createdById: req.user!.id,
        allocations: { create: allocationsToCreate },
      },
      include: { allocations: true },
    });

    await writeAudit({ userId: req.user!.id, entityType: "ActualCostTransaction", entityId: tx.id, action: "CREATE", newValue: tx });
    res.status(201).json(tx);
  })
);

// Allocate (or re-allocate) a previously unallocated transaction.
actualCostRouter.post(
  "/:id/allocate",
  requirePermission("actual_cost", "edit"),
  validateBody(z.object({ allocations: z.array(allocationLineSchema).min(1), allowOverride: z.boolean().default(false) })),
  asyncHandler(async (req, res) => {
    const tx = await prisma.actualCostTransaction.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status === "POSTED") return res.status(400).json({ error: "Posted transactions cannot be re-allocated directly; use a reversal" });

    validateAllocation(req.body.allocations, req.body.allowOverride);
    const amounts = computeAllocationAmounts(Number(tx.netAmount), req.body.allocations);

    await prisma.$transaction([
      prisma.costAllocation.deleteMany({ where: { transactionId: tx.id } }),
      prisma.costAllocation.createMany({ data: amounts.map((a) => ({ ...a, transactionId: tx.id })) }),
      prisma.actualCostTransaction.update({ where: { id: tx.id }, data: { isUnallocated: false } }),
    ]);

    await writeAudit({ userId: req.user!.id, entityType: "ActualCostTransaction", entityId: tx.id, action: "ALLOCATE", newValue: amounts });
    const updated = await prisma.actualCostTransaction.findUnique({ where: { id: tx.id }, include: { allocations: true } });
    res.json(updated);
  })
);

const statusTransition = z.object({ status: z.enum(["SUBMITTED", "REVIEWED", "APPROVED", "POSTED"]) });

actualCostRouter.post(
  "/:id/status",
  requirePermission("actual_cost", "review"),
  validateBody(statusTransition),
  asyncHandler(async (req, res) => {
    const tx = await prisma.actualCostTransaction.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status === "POSTED" || tx.status === "REVERSED") {
      return res.status(400).json({ error: "Posted/reversed transactions cannot change status directly" });
    }
    const updated = await prisma.actualCostTransaction.update({ where: { id: tx.id }, data: { status: req.body.status } });
    await writeAudit({ userId: req.user!.id, entityType: "ActualCostTransaction", entityId: updated.id, action: req.body.status, oldValue: tx, newValue: updated });
    res.json(updated);
  })
);

// Reversal: never silently edits a posted transaction — creates a REVERSED marker + a new corrected transaction.
actualCostRouter.post(
  "/:id/reverse",
  requirePermission("actual_cost", "reverse"),
  validateBody(z.object({ reason: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const tx = await prisma.actualCostTransaction.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.status !== "POSTED") return res.status(400).json({ error: "Only posted transactions can be reversed" });

    const reversal = await prisma.actualCostTransaction.create({
      data: {
        projectId: tx.projectId,
        date: new Date(),
        documentNumber: tx.documentNumber ? `${tx.documentNumber}-REV` : undefined,
        description: `Reversal of ${tx.description}`,
        netAmount: -Number(tx.netAmount),
        vatAmount: -Number(tx.vatAmount),
        grossAmount: -Number(tx.grossAmount),
        wbsId: tx.wbsId,
        boqItemId: tx.boqItemId,
        costCodeId: tx.costCodeId,
        costCategoryId: tx.costCategoryId,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        status: "POSTED",
        createdById: req.user!.id,
      },
    });
    await prisma.actualCostTransaction.update({ where: { id: tx.id }, data: { status: "REVERSED", reversedById: reversal.id } });
    await writeAudit({ userId: req.user!.id, entityType: "ActualCostTransaction", entityId: tx.id, action: "REVERSE", reason: req.body.reason, newValue: reversal });
    res.status(201).json(reversal);
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
