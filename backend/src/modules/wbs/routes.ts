import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const wbsRouter = Router({ mergeParams: true });
wbsRouter.use(requireAuth, requireProjectScope);

wbsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const nodes = await prisma.wBS.findMany({
      where: { projectId: req.projectId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });
    res.json(nodes);
  })
);

const wbsSchema = z.object({
  parentId: z.string().nullable().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().default(0),
});

wbsRouter.post(
  "/",
  requirePermission("wbs", "create"),
  validateBody(wbsSchema),
  asyncHandler(async (req, res) => {
    let level = 0;
    if (req.body.parentId) {
      const parent = await prisma.wBS.findFirst({
        where: { id: req.body.parentId, projectId: req.projectId },
      });
      if (!parent) return res.status(400).json({ error: "Parent WBS node not found" });
      level = parent.level + 1;
    }
    const node = await prisma.wBS.create({
      data: { ...req.body, projectId: req.projectId!, level },
    });
    await writeAudit({ userId: req.user!.id, entityType: "WBS", entityId: node.id, action: "CREATE", newValue: node });
    res.status(201).json(node);
  })
);

wbsRouter.put(
  "/:id",
  requirePermission("wbs", "edit"),
  validateBody(wbsSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.wBS.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "WBS node not found" });
    const updated = await prisma.wBS.update({ where: { id: req.params.id }, data: req.body });
    await writeAudit({
      userId: req.user!.id,
      entityType: "WBS",
      entityId: updated.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
    });
    res.json(updated);
  })
);

wbsRouter.delete(
  "/:id",
  requirePermission("wbs", "delete"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.wBS.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!existing) return res.status(404).json({ error: "WBS node not found" });
    const childCount = await prisma.wBS.count({ where: { parentId: req.params.id } });
    if (childCount > 0) return res.status(400).json({ error: "Cannot delete a WBS node that has children" });
    await prisma.wBS.delete({ where: { id: req.params.id } });
    await writeAudit({ userId: req.user!.id, entityType: "WBS", entityId: req.params.id, action: "DELETE", oldValue: existing });
    res.status(204).send();
  })
);
