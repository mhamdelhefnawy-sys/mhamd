import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

// Company Branding (spec §80): name, logo, address, contact, used on generated PDF reports.
export const companyRouter = Router();
companyRouter.use(requireAuth);

companyRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });
    res.json(company);
  })
);

const companySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  // Accepts a data: URI (e.g. "data:image/png;base64,...") so no separate file-storage
  // service is required for this deployment; capped well under Express's JSON body limit.
  logoUrl: z.string().max(2_000_000).optional().nullable(),
});

companyRouter.put(
  "/",
  requirePermission("settings", "manage_settings"),
  validateBody(companySchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.company.findUniqueOrThrow({ where: { id: req.user!.companyId } });
    const updated = await prisma.company.update({ where: { id: req.user!.companyId }, data: req.body });
    await writeAudit({
      userId: req.user!.id,
      entityType: "Company",
      entityId: updated.id,
      action: "UPDATE",
      oldValue: { ...existing, logoUrl: existing.logoUrl ? "[omitted]" : null },
      newValue: { ...updated, logoUrl: updated.logoUrl ? "[omitted]" : null },
    });
    res.json(updated);
  })
);
