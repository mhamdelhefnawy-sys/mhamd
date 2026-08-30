import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

// A weak/default JWT secret lets anyone forge a valid session token, so it's only
// tolerated outside production. In production the app refuses to start rather than
// silently run insecurely.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production — refusing to start with an insecure default secret.");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-.env";
const JWT_EXPIRES_IN = "8h";

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: Set<string>; // "module:action"
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: { include: { permissions: true } },
        },
      },
    },
  });
  if (!user || !user.isActive) return null;

  const roles: string[] = [];
  const permissions = new Set<string>();
  for (const ur of user.roles) {
    roles.push(ur.role.name);
    for (const p of ur.role.permissions) {
      if (p.allowed) permissions.add(`${p.module}:${p.action}`);
    }
  }
  return {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    fullName: user.fullName,
    roles,
    permissions,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = await loadAuthUser(payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid or inactive user" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Super Administrator role bypasses granular checks.
export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (user.roles.includes("Super Administrator")) return next();
    if (user.permissions.has(`${module}:${action}`)) return next();
    return res.status(403).json({
      error: `Forbidden: missing permission ${module}:${action}`,
    });
  };
}
