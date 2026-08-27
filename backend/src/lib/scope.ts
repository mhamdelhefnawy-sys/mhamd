import { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      projectId?: string;
    }
  }
}

// Verifies :projectId in the route belongs to the authenticated user's company,
// and stores it on req.projectId for handlers to use directly (avoids re-querying).
export async function requireProjectScope(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId;
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: req.user!.companyId },
    select: { id: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });
  req.projectId = projectId;
  next();
}
