import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler } from "../../lib/http";

// Global search across the entities a Cost Control Manager looks up most (spec §60).
export const searchRouter = Router({ mergeParams: true });
searchRouter.use(requireAuth, requireProjectScope);

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.json({ boqItems: [], costCodes: [], wbs: [], materials: [], subcontractors: [], actualCosts: [] });
    }
    const projectId = req.projectId!;
    const contains = { contains: q, mode: "insensitive" as const };

    const [boqItems, costCodes, wbs, materials, subcontractors, actualCosts] = await Promise.all([
      prisma.bOQItem.findMany({
        where: { projectId, OR: [{ itemNumber: contains }, { description: contains }] },
        take: 8,
        select: { id: true, itemNumber: true, description: true },
      }),
      prisma.costCode.findMany({
        where: { projectId, OR: [{ code: contains }, { description: contains }] },
        take: 8,
        select: { id: true, code: true, description: true },
      }),
      prisma.wBS.findMany({
        where: { projectId, OR: [{ code: contains }, { name: contains }] },
        take: 8,
        select: { id: true, code: true, name: true },
      }),
      prisma.material.findMany({
        where: { projectId, OR: [{ code: contains }, { description: contains }] },
        take: 8,
        select: { id: true, code: true, description: true },
      }),
      prisma.subcontractor.findMany({
        where: { projectId, companyName: contains },
        take: 8,
        select: { id: true, companyName: true, scope: true },
      }),
      prisma.actualCostTransaction.findMany({
        where: { projectId, OR: [{ description: contains }, { supplier: contains }, { documentNumber: contains }, { reference: contains }] },
        take: 8,
        select: { id: true, description: true, supplier: true, netAmount: true, date: true },
      }),
    ]);

    res.json({ boqItems, costCodes, wbs, materials, subcontractors, actualCosts });
  })
);
