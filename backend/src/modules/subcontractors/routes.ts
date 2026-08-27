import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const subcontractorsRouter = Router({ mergeParams: true });
subcontractorsRouter.use(requireAuth, requireProjectScope);

subcontractorsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.subcontractor.findMany({
      where: { projectId: req.projectId },
      include: { subcontracts: { include: { certificates: true } } },
      orderBy: { companyName: "asc" },
    });
    res.json(
      items.map((s) => ({
        ...s,
        subcontracts: s.subcontracts.map((sc) => {
          const certified = sc.certificates.reduce((sum, c) => sum + Number(c.cumulativeWorkDone), 0);
          return {
            ...sc,
            certifiedToDate: sc.certificates.length
              ? Number(sc.certificates[sc.certificates.length - 1].cumulativeWorkDone)
              : 0,
            remainingCommitment: round2(Number(sc.revisedValue) - (sc.certificates.length
              ? Number(sc.certificates[sc.certificates.length - 1].cumulativeWorkDone)
              : 0)),
          };
        }),
      }))
    );
  })
);

const subcontractorSchema = z.object({
  companyName: z.string().min(1),
  scope: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

subcontractorsRouter.post(
  "/",
  requirePermission("subcontractors", "create"),
  validateBody(subcontractorSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.subcontractor.create({ data: { ...req.body, projectId: req.projectId! } });
    await writeAudit({ userId: req.user!.id, entityType: "Subcontractor", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

const subcontractSchema = z.object({
  contractNumber: z.string().min(1),
  scope: z.string().optional(),
  costCodeId: z.string().nullable().optional(),
  originalValue: z.number(),
  advancePercent: z.number().default(0),
  retentionPercent: z.number().default(0),
});

subcontractorsRouter.post(
  "/:id/subcontracts",
  requirePermission("subcontractors", "create"),
  validateBody(subcontractSchema),
  asyncHandler(async (req, res) => {
    const subcontractor = await prisma.subcontractor.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!subcontractor) return res.status(404).json({ error: "Subcontractor not found" });
    const item = await prisma.subcontract.create({
      data: {
        ...req.body,
        subcontractorId: subcontractor.id,
        projectId: req.projectId!,
        revisedValue: req.body.originalValue,
        status: "DRAFT",
      },
    });
    await writeAudit({ userId: req.user!.id, entityType: "Subcontract", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

const certificateSchema = z.object({
  certificateNumber: z.string().min(1),
  periodDate: z.string().datetime(),
  grossWorkDone: z.number(),
  cumulativeWorkDone: z.number(),
  advanceRecovery: z.number().default(0),
  retentionHeld: z.number().default(0),
  deductions: z.number().default(0),
  backCharges: z.number().default(0),
});

subcontractorsRouter.post(
  "/subcontracts/:subcontractId/certificates",
  requirePermission("subcontractors", "create"),
  validateBody(certificateSchema),
  asyncHandler(async (req, res) => {
    const subcontract = await prisma.subcontract.findFirst({
      where: { id: req.params.subcontractId, projectId: req.projectId },
    });
    if (!subcontract) return res.status(404).json({ error: "Subcontract not found" });
    const netPayable = round2(
      req.body.grossWorkDone -
        req.body.advanceRecovery -
        req.body.retentionHeld -
        req.body.deductions -
        req.body.backCharges
    );
    const cert = await prisma.paymentCertificate.create({
      data: { ...req.body, subcontractId: subcontract.id, netPayable, status: "DRAFT" },
    });
    await prisma.subcontract.update({
      where: { id: subcontract.id },
      data: {},
    });
    await writeAudit({ userId: req.user!.id, entityType: "PaymentCertificate", entityId: cert.id, action: "CREATE", newValue: cert });
    res.status(201).json(cert);
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
