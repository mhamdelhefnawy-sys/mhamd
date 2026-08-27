import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requirePermission } from "../../lib/auth";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const adminRouter = Router();
adminRouter.use(requireAuth);

// ── Users ───────────────────────────────────────────────────────────────
adminRouter.get(
  "/users",
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { companyId: req.user!.companyId },
      include: { roles: { include: { role: true } } },
      orderBy: { fullName: "asc" },
    });
    res.json(users.map((u) => ({ ...u, passwordHash: undefined, roles: u.roles.map((r) => r.role.name) })));
  })
);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  jobTitle: z.string().optional(),
  roleIds: z.array(z.string()).default([]),
});

adminRouter.post(
  "/users",
  requirePermission("users", "manage_users"),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.create({
      data: {
        companyId: req.user!.companyId,
        email: req.body.email,
        passwordHash,
        fullName: req.body.fullName,
        jobTitle: req.body.jobTitle,
        roles: { create: req.body.roleIds.map((roleId: string) => ({ roleId })) },
      },
    });
    await writeAudit({ userId: req.user!.id, entityType: "User", entityId: user.id, action: "CREATE", newValue: { email: user.email, fullName: user.fullName } });
    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName });
  })
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  jobTitle: z.string().optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
});

adminRouter.put(
  "/users/:id",
  requirePermission("users", "manage_users"),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const { roleIds, ...rest } = req.body;
    if (roleIds) {
      await prisma.userRole.deleteMany({ where: { userId: existing.id } });
      await prisma.userRole.createMany({ data: roleIds.map((roleId: string) => ({ userId: existing.id, roleId })) });
    }
    const updated = await prisma.user.update({ where: { id: existing.id }, data: rest });
    await writeAudit({ userId: req.user!.id, entityType: "User", entityId: updated.id, action: "UPDATE", oldValue: existing, newValue: updated });
    res.json({ id: updated.id, email: updated.email, isActive: updated.isActive });
  })
);

adminRouter.post(
  "/users/:id/reset-password",
  requirePermission("users", "manage_users"),
  validateBody(z.object({ password: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    await writeAudit({ userId: req.user!.id, entityType: "User", entityId: req.params.id, action: "RESET_PASSWORD" });
    res.json({ ok: true });
  })
);

// ── Roles & Permissions ────────────────────────────────────────────────
adminRouter.get(
  "/roles",
  requirePermission("roles", "view"),
  asyncHandler(async (req, res) => {
    const roles = await prisma.role.findMany({
      where: { companyId: req.user!.companyId },
      include: { permissions: true },
      orderBy: { name: "asc" },
    });
    res.json(roles);
  })
);

const roleSchema = z.object({ name: z.string().min(1), description: z.string().optional() });

adminRouter.post(
  "/roles",
  requirePermission("roles", "manage_users"),
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.create({ data: { ...req.body, companyId: req.user!.companyId } });
    res.status(201).json(role);
  })
);

const permissionsSchema = z.object({
  permissions: z.array(z.object({ module: z.string(), action: z.string(), allowed: z.boolean() })),
});

adminRouter.put(
  "/roles/:id/permissions",
  requirePermission("roles", "manage_users"),
  validateBody(permissionsSchema),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } });
    if (!role) return res.status(404).json({ error: "Role not found" });

    await prisma.$transaction(
      req.body.permissions.map((p: { module: string; action: string; allowed: boolean }) =>
        prisma.rolePermission.upsert({
          where: { roleId_module_action: { roleId: role.id, module: p.module, action: p.action } },
          create: { roleId: role.id, module: p.module, action: p.action, allowed: p.allowed },
          update: { allowed: p.allowed },
        })
      )
    );
    await writeAudit({ userId: req.user!.id, entityType: "Role", entityId: role.id, action: "UPDATE_PERMISSIONS", newValue: req.body.permissions });
    res.json({ ok: true });
  })
);

// ── Audit Trail ─────────────────────────────────────────────────────────
adminRouter.get(
  "/audit-log",
  requirePermission("audit", "view"),
  asyncHandler(async (req, res) => {
    const { entityType, entityId, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ items, total });
  })
);
