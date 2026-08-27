import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";

// Administrator-defined construction packages (Concrete, MEP, Roads...) — never hard-coded.
export const workPackagesRouter = Router({ mergeParams: true });
workPackagesRouter.use(requireAuth, requireProjectScope);

workPackagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.workPackage.findMany({ where: { projectId: req.projectId }, orderBy: { name: "asc" } });
    res.json(items);
  })
);

const schema = z.object({ code: z.string().min(1), name: z.string().min(1) });

workPackagesRouter.post(
  "/",
  requirePermission("work_packages", "create"),
  validateBody(schema),
  asyncHandler(async (req, res) => {
    const item = await prisma.workPackage.create({ data: { ...req.body, projectId: req.projectId! } });
    res.status(201).json(item);
  })
);
