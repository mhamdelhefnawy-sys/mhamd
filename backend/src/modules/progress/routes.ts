import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { getProjectProgress } from "../../lib/services/evmService";

export const progressRouter = Router({ mergeParams: true });
progressRouter.use(requireAuth, requireProjectScope);

progressRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.progressEntry.findMany({
      where: { projectId: req.projectId },
      include: { wbs: true, boqItem: true, costCode: true },
      orderBy: { date: "desc" },
    });
    res.json(items);
  })
);

progressRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const summary = await getProjectProgress(req.projectId!);
    res.json({ ...summary, variance: round4(summary.actualPercent - summary.plannedPercent) });
  })
);

const progressSchema = z
  .object({
    date: z.string().datetime(),
    wbsId: z.string().nullable().optional(),
    boqItemId: z.string().nullable().optional(),
    costCodeId: z.string().nullable().optional(),
    method: z.enum(["MANUAL", "QUANTITY_BASED", "WEIGHTED_BOQ"]),
    plannedPercent: z.number().min(0).max(100).nullable().optional(),
    actualPercent: z.number().min(0).max(100).nullable().optional(),
    executedQuantity: z.number().nullable().optional(),
  })
  .refine(
    (d) => d.method !== "QUANTITY_BASED" || d.executedQuantity != null,
    "executedQuantity is required for the quantity-based method"
  );

progressRouter.post(
  "/",
  requirePermission("progress", "create"),
  validateBody(progressSchema),
  asyncHandler(async (req, res) => {
    let actualPercent = req.body.actualPercent ?? null;

    // Quantity-based method: Progress % = Executed Qty / Budget Qty (from the BOQ item's quantity).
    if (req.body.method === "QUANTITY_BASED" && req.body.boqItemId) {
      const boqItem = await prisma.bOQItem.findFirst({ where: { id: req.body.boqItemId, projectId: req.projectId } });
      if (boqItem && Number(boqItem.quantity) > 0) {
        actualPercent = round4((req.body.executedQuantity! / Number(boqItem.quantity)) * 100);
      }
    }

    const item = await prisma.progressEntry.create({
      data: { ...req.body, actualPercent, projectId: req.projectId! },
    });
    await writeAudit({ userId: req.user!.id, entityType: "ProgressEntry", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
