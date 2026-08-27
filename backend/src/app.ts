import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { authRouter } from "./modules/auth/routes";
import { projectsRouter } from "./modules/projects/routes";
import { wbsRouter } from "./modules/wbs/routes";
import { costCodingRouter } from "./modules/costCoding/routes";
import { boqRouter } from "./modules/boq/routes";
import { budgetRouter, variationsRouter } from "./modules/budget/routes";
import { actualCostRouter } from "./modules/actualCost/routes";
import { commitmentsRouter, accrualsRouter } from "./modules/commitments/routes";
import { subcontractorsRouter } from "./modules/subcontractors/routes";
import { materialsRouter } from "./modules/materials/routes";
import { manpowerRouter, equipmentRouter, indirectCostsRouter, fixedAssetsRouter } from "./modules/resources/routes";
import { progressRouter } from "./modules/progress/routes";
import { evmRouter } from "./modules/evm/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { alertsRouter } from "./modules/alerts/routes";
import { reportsRouter } from "./modules/reports/routes";
import { adminRouter } from "./modules/admin/routes";
import { workPackagesRouter } from "./modules/workPackages/routes";
import { approvalsRouter } from "./modules/approvals/routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/admin", adminRouter);

// Project-scoped modules: /api/projects/:projectId/<module>
app.use("/api/projects/:projectId/wbs", wbsRouter);
app.use("/api/projects/:projectId/cost-coding", costCodingRouter);
app.use("/api/projects/:projectId/boq", boqRouter);
app.use("/api/projects/:projectId/budget", budgetRouter);
app.use("/api/projects/:projectId/variations", variationsRouter);
app.use("/api/projects/:projectId/actual-costs", actualCostRouter);
app.use("/api/projects/:projectId/commitments", commitmentsRouter);
app.use("/api/projects/:projectId/accruals", accrualsRouter);
app.use("/api/projects/:projectId/subcontractors", subcontractorsRouter);
app.use("/api/projects/:projectId/materials", materialsRouter);
app.use("/api/projects/:projectId/manpower", manpowerRouter);
app.use("/api/projects/:projectId/equipment", equipmentRouter);
app.use("/api/projects/:projectId/indirect-costs", indirectCostsRouter);
app.use("/api/projects/:projectId/fixed-assets", fixedAssetsRouter);
app.use("/api/projects/:projectId/progress", progressRouter);
app.use("/api/projects/:projectId/evm", evmRouter);
app.use("/api/projects/:projectId/dashboard", dashboardRouter);
app.use("/api/projects/:projectId/alerts", alertsRouter);
app.use("/api/projects/:projectId/reports", reportsRouter);
app.use("/api/projects/:projectId/work-packages", workPackagesRouter);
app.use("/api/projects/:projectId/approvals", approvalsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
});
