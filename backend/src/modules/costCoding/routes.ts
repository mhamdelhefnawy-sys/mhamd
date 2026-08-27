import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const costCodingRouter = Router({ mergeParams: true });
costCodingRouter.use(requireAuth, requireProjectScope);

// ── Cost Categories ─────────────────────────────────────────────────────
const categorySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

costCodingRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const items = await prisma.costCategory.findMany({ where: { projectId: req.projectId }, orderBy: { code: "asc" } });
    res.json(items);
  })
);

costCodingRouter.post(
  "/categories",
  requirePermission("cost_codes", "create"),
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.costCategory.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "CostCategory", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

costCodingRouter.put(
  "/categories/:id",
  requirePermission("cost_codes", "edit"),
  validateBody(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.costCategory.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "Cost category not found" });
    const updated = await prisma.costCategory.update({ where: { id: req.params.id }, data: req.body });
    await writeAudit({ userId: req.user!.id, entityType: "CostCategory", entityId: updated.id, action: "UPDATE", oldValue: existing, newValue: updated });
    res.json(updated);
  })
);

// ── Cost Codes ──────────────────────────────────────────────────────────
const costCodeSchema = z.object({
  parentId: z.string().nullable().optional(),
  code: z.string().min(1),
  description: z.string().min(1),
  division: z.string().optional(),
  costCategoryId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

costCodingRouter.get(
  "/codes",
  asyncHandler(async (req, res) => {
    const items = await prisma.costCode.findMany({
      where: { projectId: req.projectId },
      include: { costCategory: true },
      orderBy: { code: "asc" },
    });
    res.json(items);
  })
);

costCodingRouter.post(
  "/codes",
  requirePermission("cost_codes", "create"),
  validateBody(costCodeSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.costCode.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "CostCode", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

costCodingRouter.put(
  "/codes/:id",
  requirePermission("cost_codes", "edit"),
  validateBody(costCodeSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.costCode.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "Cost code not found" });
    const updated = await prisma.costCode.update({ where: { id: req.params.id }, data: req.body });
    await writeAudit({ userId: req.user!.id, entityType: "CostCode", entityId: updated.id, action: "UPDATE", oldValue: existing, newValue: updated });
    res.json(updated);
  })
);

costCodingRouter.delete(
  "/codes/:id",
  requirePermission("cost_codes", "delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.costCode.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "Cost code not found" });
    const usageCount = await prisma.actualCostTransaction.count({ where: { costCodeId: req.params.id } });
    if (usageCount > 0) return res.status(400).json({ error: "Cannot delete a cost code that has posted transactions" });
    await prisma.costCode.delete({ where: { id: req.params.id } });
    await writeAudit({ userId: req.user!.id, entityType: "CostCode", entityId: req.params.id, action: "DELETE", oldValue: existing });
    res.status(204).send();
  })
);
