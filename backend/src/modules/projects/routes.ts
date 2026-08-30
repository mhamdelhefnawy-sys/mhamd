import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  })
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  })
);

const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  client: z.string().optional(),
  mainContractor: z.string().optional(),
  consultant: z.string().optional(),
  contractNumber: z.string().optional(),
  contractType: z.string().optional(),
  originalContractValue: z.number().default(0),
  currentContractValue: z.number().default(0),
  contractStartDate: z.string().datetime().optional().nullable(),
  originalFinishDate: z.string().datetime().optional().nullable(),
  currentFinishDate: z.string().datetime().optional().nullable(),
  currency: z.string().default("SAR"),
  vatRate: z.number().default(15),
  projectManager: z.string().optional(),
  costControlManager: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "CLOSED"]).default("PLANNING"),
  location: z.string().optional(),
  description: z.string().optional(),
  eacFormula: z
    .enum(["AC_PLUS_ETC", "BAC_OVER_CPI", "AC_PLUS_BAC_MINUS_EV", "AC_PLUS_BAC_MINUS_EV_OVER_CPI"])
    .default("AC_PLUS_ETC"),
  headOfficeOverheadPercent: z.number().min(0).max(100).default(0),
  insuranceRate: z.number().min(0).max(100).default(0),
  provisionRate: z.number().min(0).max(100).default(0),
});

projectsRouter.post(
  "/",
  requirePermission("projects", "create"),
  validateBody(projectSchema),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.create({
      data: { ...req.body, companyId: req.user!.companyId },
    });
    await writeAudit({
      userId: req.user!.id,
      entityType: "Project",
      entityId: project.id,
      action: "CREATE",
      newValue: project,
    });
    res.status(201).json(project);
  })
);

projectsRouter.put(
  "/:id",
  requirePermission("projects", "edit"),
  validateBody(projectSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!existing) return res.status(404).json({ error: "Project not found" });
    const updated = await prisma.project.update({ where: { id: req.params.id }, data: req.body });
    await writeAudit({
      userId: req.user!.id,
      entityType: "Project",
      entityId: updated.id,
      action: "UPDATE",
      oldValue: existing,
      newValue: updated,
    });
    res.json(updated);
  })
);
