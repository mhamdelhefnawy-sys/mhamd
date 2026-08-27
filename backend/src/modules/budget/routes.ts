import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { computeBudgetRollup } from "../../lib/calc/budget";

export const budgetRouter = Router({ mergeParams: true });
budgetRouter.use(requireAuth, requireProjectScope);

budgetRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const budgets = await prisma.budget.findMany({
      where: { projectId: req.projectId },
      orderBy: { version: "desc" },
      include: { _count: { select: { lines: true } } },
    });
    res.json(budgets);
  })
);

budgetRouter.get(
  "/:id/lines",
  asyncHandler(async (req, res) => {
    const lines = await prisma.budgetLine.findMany({
      where: { budgetId: req.params.id },
      include: { wbs: true, boqItem: true, costCode: true, costCategory: true },
    });
    res.json(lines);
  })
);

const lineSchema = z.object({
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  costCategoryId: z.string().nullable().optional(),
  budgetQuantity: z.number().nullable().optional(),
  budgetRate: z.number().nullable().optional(),
  budgetAmount: z.number(),
});

const createBudgetSchema = z.object({
  label: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});

// Creates a new Budget version (Original if none exists, otherwise a revision) — never overwrites a prior version.
budgetRouter.post(
  "/",
  requirePermission("budget", "create"),
  validateBody(createBudgetSchema),
  asyncHandler(async (req, res) => {
    const lastVersion = await prisma.budget.findFirst({
      where: { projectId: req.projectId },
      orderBy: { version: "desc" },
    });
    const version = (lastVersion?.version ?? 0) + 1;

    const budget = await prisma.budget.create({
      data: {
        projectId: req.projectId!,
        version,
        label: req.body.label,
        status: "DRAFT",
        lines: {
          create: req.body.lines.map((l: z.infer<typeof lineSchema>) => ({ ...l, projectId: req.projectId! })),
        },
      },
      include: { lines: true },
    });

    if (lastVersion) {
      const priorTotal = (await prisma.budgetLine.aggregate({
        where: { budgetId: lastVersion.id },
        _sum: { budgetAmount: true },
      }))._sum.budgetAmount;
      const newTotal = budget.lines.reduce((s, l) => s + Number(l.budgetAmount), 0);
      await prisma.budgetRevision.create({
        data: {
          budgetId: budget.id,
          reason: req.body.label,
          deltaAmount: newTotal - Number(priorTotal ?? 0),
          changedById: req.user!.id,
        },
      });
    }

    await writeAudit({ userId: req.user!.id, entityType: "Budget", entityId: budget.id, action: "CREATE", newValue: { version, label: req.body.label } });
    res.status(201).json(budget);
  })
);

budgetRouter.post(
  "/:id/approve",
  requirePermission("budget", "approve"),
  asyncHandler(async (req, res) => {
    const budget = await prisma.budget.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    await prisma.budget.updateMany({
      where: { projectId: req.projectId, status: "APPROVED" },
      data: { status: "SUPERSEDED" },
    });
    const updated = await prisma.budget.update({ where: { id: budget.id }, data: { status: "APPROVED", approvedAt: new Date() } });
    await writeAudit({ userId: req.user!.id, entityType: "Budget", entityId: updated.id, action: "APPROVE", oldValue: budget, newValue: updated });
    res.json(updated);
  })
);

// Current Budget (BAC) summary: Original + Approved Variations = Revised = Current.
budgetRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const original = await prisma.budget.findFirst({ where: { projectId: req.projectId, version: 1 } });
    const originalTotal = original
      ? (await prisma.budgetLine.aggregate({ where: { budgetId: original.id }, _sum: { budgetAmount: true } }))._sum
          .budgetAmount
      : 0;
    const variations = await prisma.variation.aggregate({
      where: { projectId: req.projectId, status: "APPROVED" },
      _sum: { amount: true },
    });
    const rollup = computeBudgetRollup({
      originalBudget: Number(originalTotal ?? 0),
      approvedVariations: Number(variations._sum.amount ?? 0),
    });
    res.json(rollup);
  })
);

// ── Variations ──────────────────────────────────────────────────────────
export const variationsRouter = Router({ mergeParams: true });
variationsRouter.use(requireAuth, requireProjectScope);

variationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.variation.findMany({ where: { projectId: req.projectId }, orderBy: { number: "asc" } });
    res.json(items);
  })
);

const variationSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
});

variationsRouter.post(
  "/",
  requirePermission("variations", "create"),
  validateBody(variationSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.variation.create({ data: { ...req.body, projectId: req.projectId!, status: "DRAFT" } });
    await writeAudit({ userId: req.user!.id, entityType: "Variation", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

variationsRouter.post(
  "/:id/approve",
  requirePermission("variations", "approve"),
  asyncHandler(async (req, res) => {
    const item = await prisma.variation.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!item) return res.status(404).json({ error: "Variation not found" });
    const updated = await prisma.variation.update({
      where: { id: item.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    await writeAudit({ userId: req.user!.id, entityType: "Variation", entityId: updated.id, action: "APPROVE", oldValue: item, newValue: updated });
    res.json(updated);
  })
);

variationsRouter.post(
  "/:id/reject",
  requirePermission("variations", "approve"),
  asyncHandler(async (req, res) => {
    const item = await prisma.variation.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!item) return res.status(404).json({ error: "Variation not found" });
    const updated = await prisma.variation.update({ where: { id: item.id }, data: { status: "REJECTED" } });
    await writeAudit({ userId: req.user!.id, entityType: "Variation", entityId: updated.id, action: "REJECT", oldValue: item, newValue: updated });
    res.json(updated);
  })
);
