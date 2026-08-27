import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

// ── Manpower ────────────────────────────────────────────────────────────
export const manpowerRouter = Router({ mergeParams: true });
manpowerRouter.use(requireAuth, requireProjectScope);

manpowerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.manpowerEntry.findMany({ where: { projectId: req.projectId }, orderBy: { date: "desc" } });
    res.json(items);
  })
);

const manpowerSchema = z.object({
  date: z.string().datetime(),
  category: z.string().min(1),
  trade: z.string().optional(),
  wbsId: z.string().nullable().optional(),
  boqItemId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  headcount: z.number().default(1),
  hours: z.number().nullable().optional(),
  days: z.number().nullable().optional(),
  rate: z.number().nonnegative(),
  overtimeHours: z.number().default(0),
  overtimeRate: z.number().default(0),
});

manpowerRouter.post(
  "/",
  requirePermission("manpower", "create"),
  validateBody(manpowerSchema),
  asyncHandler(async (req, res) => {
    const base = (req.body.hours ?? req.body.days ?? 1) * req.body.headcount * req.body.rate;
    const overtime = req.body.overtimeHours * req.body.overtimeRate;
    const totalCost = round2(base + overtime);
    const item = await prisma.manpowerEntry.create({ data: { ...req.body, totalCost, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "ManpowerEntry", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// ── Equipment ───────────────────────────────────────────────────────────
export const equipmentRouter = Router({ mergeParams: true });
equipmentRouter.use(requireAuth, requireProjectScope);

equipmentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.equipmentEntry.findMany({ where: { projectId: req.projectId }, orderBy: { date: "desc" } });
    res.json(items);
  })
);

const equipmentSchema = z.object({
  date: z.string().datetime(),
  equipmentName: z.string().min(1),
  equipmentType: z.string().optional(),
  ownership: z.enum(["OWNED", "RENTED"]),
  dailyRate: z.number().nullable().optional(),
  hourlyRate: z.number().nullable().optional(),
  operatingHours: z.number().default(0),
  standbyHours: z.number().default(0),
  fuelCost: z.number().default(0),
  maintenanceCost: z.number().default(0),
  operator: z.string().optional(),
  wbsId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
});

equipmentRouter.post(
  "/",
  requirePermission("equipment", "create"),
  validateBody(equipmentSchema),
  asyncHandler(async (req, res) => {
    const usageCost = req.body.hourlyRate
      ? (req.body.operatingHours + req.body.standbyHours) * req.body.hourlyRate
      : (req.body.dailyRate ?? 0);
    const totalCost = round2(usageCost + req.body.fuelCost + req.body.maintenanceCost);
    const item = await prisma.equipmentEntry.create({ data: { ...req.body, totalCost, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "EquipmentEntry", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// ── Indirect Costs ──────────────────────────────────────────────────────
export const indirectCostsRouter = Router({ mergeParams: true });
indirectCostsRouter.use(requireAuth, requireProjectScope);

indirectCostsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.indirectCostEntry.findMany({ where: { projectId: req.projectId }, orderBy: { date: "desc" } });
    res.json(items);
  })
);

const indirectSchema = z.object({
  date: z.string().datetime(),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  allocationMethod: z.enum(["PROJECT_LEVEL", "ALLOCATED"]).default("PROJECT_LEVEL"),
  wbsId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
});

indirectCostsRouter.post(
  "/",
  requirePermission("indirect_costs", "create"),
  validateBody(indirectSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.indirectCostEntry.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "IndirectCostEntry", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// ── Fixed Assets ────────────────────────────────────────────────────────
export const fixedAssetsRouter = Router({ mergeParams: true });
fixedAssetsRouter.use(requireAuth, requireProjectScope);

fixedAssetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.fixedAsset.findMany({ where: { projectId: req.projectId }, include: { depreciationEntries: true } });
    res.json(items);
  })
);

const fixedAssetSchema = z.object({
  assetTag: z.string().min(1),
  description: z.string().min(1),
  purchaseDate: z.string().datetime(),
  purchaseCost: z.number().nonnegative(),
  usefulLifeMonths: z.number().int().positive(),
  depreciationMethod: z.string().default("STRAIGHT_LINE"),
  costCodeId: z.string().nullable().optional(),
});

fixedAssetsRouter.post(
  "/",
  requirePermission("fixed_assets", "create"),
  validateBody(fixedAssetSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.fixedAsset.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "FixedAsset", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// Generates the next straight-line monthly depreciation entry for an asset.
fixedAssetsRouter.post(
  "/:id/depreciate",
  requirePermission("fixed_assets", "post"),
  validateBody(z.object({ periodDate: z.string().datetime() })),
  asyncHandler(async (req, res) => {
    const asset = await prisma.fixedAsset.findFirst({
      where: { id: req.params.id, projectId: req.projectId },
      include: { depreciationEntries: true },
    });
    if (!asset) return res.status(404).json({ error: "Fixed asset not found" });
    const monthly = round2(Number(asset.purchaseCost) / asset.usefulLifeMonths);
    const priorAccum = asset.depreciationEntries.reduce((s, d) => s + Number(d.monthlyDepreciation), 0);
    const accumulated = round2(Math.min(priorAccum + monthly, Number(asset.purchaseCost)));
    const netBookValue = round2(Number(asset.purchaseCost) - accumulated);
    const entry = await prisma.depreciationEntry.create({
      data: {
        fixedAssetId: asset.id,
        periodDate: req.body.periodDate,
        monthlyDepreciation: monthly,
        accumulatedDepreciation: accumulated,
        netBookValue,
      },
    });
    res.status(201).json(entry);
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
