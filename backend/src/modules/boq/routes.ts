import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { requireProjectScope } from "../../lib/scope";
import { asyncHandler, validateBody, HttpError } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { parseWorkbook, mapAndValidateRows, ValidationError } from "../../lib/importEngine";
import { buildExcelReport } from "../../lib/excelExport";

export const boqRouter = Router({ mergeParams: true });
boqRouter.use(requireAuth, requireProjectScope);

const ALLOWED_IMPORT_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  "application/octet-stream", // some browsers/OSes send this for .xlsx — extension check below covers it
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (ALLOWED_IMPORT_MIME_TYPES.has(file.mimetype) && extOk) return cb(null, true);
    cb(new HttpError(400, "Only .xlsx, .xls, or .csv files are accepted"));
  },
});

boqRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.bOQItem.findMany({
      where: { projectId: req.projectId },
      include: { wbs: true, costCode: true, workPackage: true },
      orderBy: { itemNumber: "asc" },
    });
    res.json(items);
  })
);

const boqSchema = z.object({
  itemNumber: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitRate: z.number().nonnegative(),
  division: z.string().optional(),
  section: z.string().optional(),
  wbsId: z.string().nullable().optional(),
  costCodeId: z.string().nullable().optional(),
  workPackageId: z.string().nullable().optional(),
  progressWeight: z.number().nullable().optional(),
  notes: z.string().optional(),
});

async function createBoqItem(projectId: string, userId: string, input: z.infer<typeof boqSchema>) {
  const totalAmount = round2(input.quantity * input.unitRate);
  const item = await prisma.bOQItem.create({
    data: { ...input, totalAmount, projectId, status: "ORIGINAL" },
  });
  await prisma.bOQRevisionLine.create({
    data: {
      boqItemId: item.id,
      revisionNo: 1,
      reason: "Original BOQ entry",
      quantity: input.quantity,
      unitRate: input.unitRate,
      totalAmount,
      status: "ORIGINAL",
      changedById: userId,
    },
  });
  return item;
}

boqRouter.post(
  "/",
  requirePermission("boq", "create"),
  validateBody(boqSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.bOQItem.findFirst({
      where: { projectId: req.projectId, itemNumber: req.body.itemNumber },
    });
    if (existing) return res.status(400).json({ error: `Duplicate BOQ item number: ${req.body.itemNumber}` });
    const item = await createBoqItem(req.projectId!, req.user!.id, req.body);
    await writeAudit({ userId: req.user!.id, entityType: "BOQItem", entityId: item.id, action: "CREATE", newValue: item });
    res.status(201).json(item);
  })
);

// Revising a BOQ item never overwrites — it appends a new revision line and updates the current view.
const reviseSchema = z.object({
  quantity: z.number().nonnegative(),
  unitRate: z.number().nonnegative(),
  reason: z.string().min(1),
  status: z.enum(["REVISED", "APPROVED_VARIATION", "PENDING_VARIATION", "FINAL"]).default("REVISED"),
});

boqRouter.post(
  "/:id/revise",
  requirePermission("boq", "edit"),
  validateBody(reviseSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.bOQItem.findFirst({ where: { id: req.params.id, projectId: req.projectId } });
    if (!item) return res.status(404).json({ error: "BOQ item not found" });
    const lastRevision = await prisma.bOQRevisionLine.findFirst({
      where: { boqItemId: item.id },
      orderBy: { revisionNo: "desc" },
    });
    const totalAmount = round2(req.body.quantity * req.body.unitRate);
    const [, updated] = await prisma.$transaction([
      prisma.bOQRevisionLine.create({
        data: {
          boqItemId: item.id,
          revisionNo: (lastRevision?.revisionNo ?? 0) + 1,
          reason: req.body.reason,
          quantity: req.body.quantity,
          unitRate: req.body.unitRate,
          totalAmount,
          status: req.body.status,
          changedById: req.user!.id,
        },
      }),
      prisma.bOQItem.update({
        where: { id: item.id },
        data: { quantity: req.body.quantity, unitRate: req.body.unitRate, totalAmount, status: req.body.status },
      }),
    ]);
    await writeAudit({
      userId: req.user!.id,
      entityType: "BOQItem",
      entityId: item.id,
      action: "REVISE",
      oldValue: item,
      newValue: updated,
      reason: req.body.reason,
    });
    res.json(updated);
  })
);

boqRouter.get(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const revisions = await prisma.bOQRevisionLine.findMany({
      where: { boqItemId: req.params.id },
      orderBy: { revisionNo: "asc" },
    });
    res.json(revisions);
  })
);

// ── Excel Import: preview (no commit) ──────────────────────────────────
const REQUIRED_FIELDS = ["itemNumber", "description", "unit", "quantity", "unitRate"] as const;

boqRouter.post(
  "/import/preview",
  requirePermission("boq", "import"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const sheet = await parseWorkbook(req.file.buffer);
    res.json({ headers: sheet.headers, sampleRows: sheet.rows.slice(0, 10), totalRows: sheet.rows.length });
  })
);

const importCommitSchema = z.object({
  mapping: z.record(z.string()),
  commit: z.boolean().default(false),
});

boqRouter.post(
  "/import/validate",
  requirePermission("boq", "import"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const body = importCommitSchema.parse({ ...req.body, mapping: JSON.parse(req.body.mapping || "{}") });
    const sheet = await parseWorkbook(req.file.buffer);

    const existingItemNumbers = new Set(
      (await prisma.bOQItem.findMany({ where: { projectId: req.projectId }, select: { itemNumber: true } })).map(
        (b) => b.itemNumber
      )
    );
    const seenInFile = new Set<string>();

    const result = mapAndValidateRows(sheet, body.mapping, (mapped, rowNum) => {
      const errors: ValidationError[] = [];
      for (const f of REQUIRED_FIELDS) {
        if (mapped[f] === undefined || mapped[f] === null || mapped[f] === "") {
          errors.push({ row: rowNum, field: f, message: `Missing ${f}` });
        }
      }
      const itemNumber = String(mapped.itemNumber ?? "").trim();
      if (itemNumber) {
        if (existingItemNumbers.has(itemNumber)) {
          errors.push({ row: rowNum, field: "itemNumber", message: `Duplicate of existing BOQ item ${itemNumber}` });
        }
        if (seenInFile.has(itemNumber)) {
          errors.push({ row: rowNum, field: "itemNumber", message: `Duplicate within uploaded file: ${itemNumber}` });
        }
        seenInFile.add(itemNumber);
      }
      const quantity = Number(mapped.quantity);
      const unitRate = Number(mapped.unitRate);
      if (mapped.quantity !== undefined && (Number.isNaN(quantity) || quantity < 0)) {
        errors.push({ row: rowNum, field: "quantity", message: "Invalid quantity" });
      }
      if (mapped.unitRate !== undefined && (Number.isNaN(unitRate) || unitRate < 0)) {
        errors.push({ row: rowNum, field: "unitRate", message: "Invalid unit rate" });
      }
      if (errors.length > 0) return { errors };
      return {
        errors: [],
        value: {
          itemNumber,
          description: String(mapped.description ?? "").trim(),
          unit: String(mapped.unit ?? "").trim(),
          quantity,
          unitRate,
          division: mapped.division ? String(mapped.division) : undefined,
          section: mapped.section ? String(mapped.section) : undefined,
        },
      };
    });

    if (body.commit) {
      if (result.errors.length > 0) {
        return res.status(400).json({ error: "Cannot commit while validation errors remain", ...result });
      }
      // Batched insert (2 statements total) instead of two sequential creates per
      // row — a bulk Excel import of thousands of BOQ items would otherwise mean
      // thousands of sequential round trips to the database.
      const rows = result.valid.map((row: any) => ({ id: randomUUID(), row, totalAmount: round2(row.quantity * row.unitRate) }));
      if (rows.length > 0) {
        await prisma.$transaction([
          prisma.bOQItem.createMany({
            data: rows.map(({ id, row, totalAmount }) => ({
              id,
              projectId: req.projectId!,
              itemNumber: row.itemNumber,
              description: row.description,
              unit: row.unit,
              quantity: row.quantity,
              unitRate: row.unitRate,
              totalAmount,
              division: row.division,
              section: row.section,
              status: "ORIGINAL" as const,
            })),
          }),
          prisma.bOQRevisionLine.createMany({
            data: rows.map(({ id, row, totalAmount }) => ({
              boqItemId: id,
              revisionNo: 1,
              reason: "Original BOQ entry (bulk import)",
              quantity: row.quantity,
              unitRate: row.unitRate,
              totalAmount,
              status: "ORIGINAL" as const,
              changedById: req.user!.id,
            })),
          }),
        ]);
      }
      await writeAudit({
        userId: req.user!.id,
        entityType: "BOQItem",
        entityId: "bulk-import",
        action: "IMPORT",
        newValue: { count: rows.length },
      });
      return res.json({ imported: rows.length, summary: result.summary });
    }

    res.json(result);
  })
);

boqRouter.get(
  "/export",
  requirePermission("boq", "export"),
  asyncHandler(async (req, res) => {
    const items = await prisma.bOQItem.findMany({
      where: { projectId: req.projectId },
      include: { wbs: true, costCode: true },
      orderBy: { itemNumber: "asc" },
    });
    const buffer = await buildExcelReport(
      "BOQ",
      [
        { header: "Item No.", key: "itemNumber", width: 14 },
        { header: "Description", key: "description", width: 40 },
        { header: "Unit", key: "unit", width: 10 },
        { header: "Quantity", key: "quantity", width: 14, numFmt: "#,##0.00" },
        { header: "Unit Rate", key: "unitRate", width: 14, numFmt: "#,##0.00" },
        { header: "Total Amount", key: "totalAmount", width: 16, numFmt: "#,##0.00" },
        { header: "WBS", key: "wbs", width: 20 },
        { header: "Cost Code", key: "costCode", width: 16 },
        { header: "Status", key: "status", width: 14 },
      ],
      items.map((i) => ({
        itemNumber: i.itemNumber,
        description: i.description,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitRate: Number(i.unitRate),
        totalAmount: Number(i.totalAmount),
        wbs: i.wbs?.name ?? "",
        costCode: i.costCode?.code ?? "",
        status: i.status,
      }))
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=BOQ.xlsx");
    res.send(buffer);
  })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
