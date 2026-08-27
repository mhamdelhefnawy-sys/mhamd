import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";

export const alertsRouter = Router({ mergeParams: true });
alertsRouter.use(requireAuth, requireProjectScope);

alertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.alert.findMany({ where: { projectId: req.projectId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  })
);

alertsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const item = await prisma.alert.updateMany({
      where: { id: req.params.id, projectId: req.projectId },
      data: { isRead: true },
    });
    res.json({ updated: item.count });
  })
);

// ── Alert Rules (configurable thresholds, never hard-coded) ──────────────
alertsRouter.get(
  "/rules",
  asyncHandler(async (req, res) => {
    const rules = await prisma.alertRule.findMany({ where: { projectId: req.projectId } });
    res.json(rules);
  })
);

const ruleSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(["LT", "LTE", "GT", "GTE", "EQ"]),
  threshold: z.number(),
  severity: z.enum(["GREEN", "YELLOW", "RED", "BLACK"]),
  isActive: z.boolean().default(true),
});

alertsRouter.post(
  "/rules",
  requirePermission("alerts", "manage_settings"),
  validateBody(ruleSchema),
  asyncHandler(async (req, res) => {
    const rule = await prisma.alertRule.create({ data: { ...req.body, projectId: req.projectId! } });
    res.status(201).json(rule);
  })
);

alertsRouter.put(
  "/rules/:id",
  requirePermission("alerts", "manage_settings"),
  validateBody(ruleSchema.partial()),
  asyncHandler(async (req, res) => {
    const rule = await prisma.alertRule.updateMany({
      where: { id: req.params.id, projectId: req.projectId },
      data: req.body,
    });
    res.json({ updated: rule.count });
  })
);
