import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken, requireAuth } from "../../lib/auth";
import { asyncHandler, validateBody } from "../../lib/http";
import { writeAudit } from "../../lib/audit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit({ userId: user.id, entityType: "User", entityId: user.id, action: "LOGIN" });

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, companyId: user.companyId },
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        fullName: req.user!.fullName,
        roles: req.user!.roles,
        permissions: Array.from(req.user!.permissions),
      },
    });
  })
);
