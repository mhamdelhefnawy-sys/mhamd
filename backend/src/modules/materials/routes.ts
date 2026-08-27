import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { computeMaterialLoss } from "../../lib/calc/materialLoss";

export const materialsRouter = Router({ mergeParams: true });
materialsRouter.use(requireAuth, requireProjectScope);

materialsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.material.findMany({
      where: { projectId: req.projectId },
      include: {
        receipts: true,
        issues: true,
        returns: true,
        consumptions: true,
        losses: true,
      },
      orderBy: { code: "asc" },
    });
    res.json(
      items.map((m) => {
        const received = sum(m.receipts.map((r) => Number(r.quantity)));
        const issued = sum(m.issues.map((i) => Number(i.quantity)));
        const returned = sum(m.returns.map((r) => Number(r.quantity)));
        const consumed = sum(m.consumptions.map((c) => Number(c.quantity)));
        const balance = round4(received - issued + returned);
        return {
          id: m.id,
          code: m.code,
          description: m.description,
          unit: m.unit,
          allowedWastePercent: Number(m.allowedWastePercent),
          standardRate: m.standardRate ? Number(m.standardRate) : null,
          purchasedQty: received,
          receivedQty: received,
          issuedQty: issued,
          returnedQty: returned,
          consumedQty: consumed,
          balanceQty: balance,
          totalLossCost: sum(m.losses.map((l) => Number(l.lossCost))),
        };
      })
    );
  })
);

const materialSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  costCodeId: z.string().nullable().optional(),
  allowedWastePercent: z.number().default(2),
  standardRate: z.number().nullable().optional(),
});

materialsRouter.post(
  "/",
  requirePermission("materials", "create"),
  validateBody(materialSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.material.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "Material", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// ── Storage / transactions ─────────────────────────────────────────────
const receiptSchema = z.object({ date: z.string().datetime(), supplier: z.string().optional(), quantity: z.number().positive(), unitRate: z.number().nonnegative(), reference: z.string().optional() });
materialsRouter.post(
  "/:id/receipts",
  requirePermission("materials", "create"),
  validateBody(receiptSchema),
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!material) return res.status(404).json({ error: "Material not found" });
    const amount = round2(req.body.quantity * req.body.unitRate);
    const item = await prisma.materialReceipt.create({ data: { ...req.body, materialId: material.id, amount } });
    await writeAudit({ userId: req.user!.id, entityType: "MaterialReceipt", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

const issueSchema = z.object({ date: z.string().datetime(), wbsId: z.string().nullable().optional(), boqItemId: z.string().nullable().optional(), quantity: z.number().positive(), issuedTo: z.string().optional() });
materialsRouter.post(
  "/:id/issues",
  requirePermission("materials", "create"),
  validateBody(issueSchema),
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!material) return res.status(404).json({ error: "Material not found" });
    const item = await prisma.materialIssue.create({ data: { ...req.body, materialId: material.id } });
    await writeAudit({ userId: req.user!.id, entityType: "MaterialIssue", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

const returnSchema = z.object({ date: z.string().datetime(), quantity: z.number().positive(), reason: z.string().optional() });
materialsRouter.post(
  "/:id/returns",
  requirePermission("materials", "create"),
  validateBody(returnSchema),
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!material) return res.status(404).json({ error: "Material not found" });
    const item = await prisma.materialReturn.create({ data: { ...req.body, materialId: material.id } });
    res.status(201).json(item);
  })
);

// Recording consumption against a budget quantity automatically computes & stores the loss.
const consumptionSchema = z.object({
  date: z.string().datetime(),
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  budgetQuantity: z.number().nonnegative(),
  quantity: z.number().nonnegative(),
});
materialsRouter.post(
  "/:id/consumptions",
  requirePermission("materials", "create"),
  validateBody(consumptionSchema),
  asyncHandler(async (req, res) => {
    const material = await prisma.material.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!material) return res.status(404).json({ error: "Material not found" });

    const consumption = await prisma.materialConsumption.create({ data: { ...req.body, materialId: material.id } });

    const rate = material.standardRate ? Number(material.standardRate) : 0;
    const loss = computeMaterialLoss({
      budgetQuantity: req.body.budgetQuantity,
      actualUsedQuantity: req.body.quantity,
      allowedWastePercent: Number(material.allowedWastePercent),
      unitRate: rate,
    });
    const lossRecord = await prisma.materialLoss.create({
      data: {
        materialId: material.id,
        date: req.body.date,
        budgetQuantity: req.body.budgetQuantity,
        actualUsedQuantity: req.body.quantity,
        lossQuantity: loss.lossQuantity,
        allowedWastePercent: material.allowedWastePercent,
        actualWastePercent: loss.actualWastePercent,
        lossCost: loss.excessCost,
      },
    });

    if (loss.isOverAllowed) {
      await prisma.alert.create({
        data: {
          projectId: req.projectId!,
          severity: loss.excessWastePercent > 5 ? "RED" : "YELLOW",
          message: `Material waste for ${material.code} (${material.description}) exceeded allowed limit: actual ${loss.actualWastePercent}% vs allowed ${material.allowedWastePercent}%`,
          entityType: "Material",
          entityId: material.id,
        },
      });
    }

    res.status(201).json({ consumption, loss: lossRecord });
  })
);

materialsRouter.get(
  "/:id/losses",
  asyncHandler(async (req, res) => {
    const losses = await prisma.materialLoss.findMany({ where: { materialId: req.params.id }, orderBy: { date: "desc" } });
    res.json(losses);
  })
);

function sum(nums: number[]) {
  return round4(nums.reduce((a, b) => a + b, 0));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
