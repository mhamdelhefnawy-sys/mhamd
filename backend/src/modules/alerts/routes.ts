import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { evaluateProjectAlerts } from "../../lib/services/alertEngine";
import { computeProjectEvmAndForecast } from "../evm/routes";
import { getUnallocatedTotal } from "../../lib/services/evmService";

export const alertsRouter = Router({ mergeParams: true });
alertsRouter.use(requireAuth, requireProjectScope);

// Manually re-run the alert engine (the dashboard also triggers this on every load).
alertsRouter.post(
  "/evaluate",
  asyncHandler(async (req, res) => {
    const projectId = req.projectId!;
    const { evm, forecast } = await computeProjectEvmAndForecast(projectId);
    const unallocated = await getUnallocatedTotal(projectId);
    await evaluateProjectAlerts(projectId, { cpi: evm.cpi, spi: evm.spi, vac: forecast.vac, eac: forecast.eac, unallocatedCost: unallocated });
    const items = await prisma.alert.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  })
);

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
