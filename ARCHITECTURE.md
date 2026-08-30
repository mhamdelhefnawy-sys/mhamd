# Construction Project Cost Control & Management System — Architecture

Status: **Phase 1 delivered** (see "Delivery Phases" below). This document is the
architecture deliverable required before implementation and is kept up to date
as the system grows.

## 1. System Architecture

Layered, API-first, multi-project-ready architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — Next.js 14 (App Router) + TypeScript + Tailwind  │
│  React Query for data fetching, Recharts for visualization    │
└───────────────────────────┬───────────────────────────────────┘
                             │ REST/JSON over HTTPS
┌───────────────────────────▼───────────────────────────────────┐
│  Backend API — Node.js + TypeScript + Express                 │
│  Modules: auth, projects, wbs, boq, cost-codes, budget,        │
│  actual-cost, commitments, accruals, allocation, subcontractors,│
│  materials, manpower, equipment, indirect-costs, progress,     │
│  forecast/evm, reports, alerts, audit, admin, import/export    │
│  Cross-cutting: authn (JWT), RBAC middleware, audit logging,   │
│  validation (zod), server-side calculation engine              │
└───────────────────────────┬───────────────────────────────────┘
                             │ Prisma ORM
┌───────────────────────────▼───────────────────────────────────┐
│  PostgreSQL — normalized relational schema (see prisma/schema) │
└─────────────────────────────────────────────────────────────────┘
```

Key principles applied throughout:
- **Multi-project & multi-company ready**: every transactional table carries a
  `projectId`; a `Company` entity sits above `Project` for future multi-tenant use.
- **No hard-coded business logic**: Cost Categories, Cost Codes, Work Packages,
  Alert Thresholds, VAT rate, EAC formula, WBS depth are all data, editable by
  an administrator via Settings/Admin modules, not constants in code.
- **Calculations are server-side only**: EVM (EV/PV/AC/CV/SV/CPI/SPI),
  EAC/ETC/VAC, allocation math, material loss %, budget roll-ups are computed
  in the backend calculation engine (`backend/src/lib/calc/`) and are
  reproducible from stored transactions — the frontend only renders results.
- **Traceability**: every aggregate value exposes a drill-down path down to the
  originating transaction id (see §9 Data Flow).
- **Never overwrite history**: BOQ revisions, Budget revisions, Report
  snapshots and Audit Log are append-only.

## 2. Database ERD (textual — see `backend/prisma/schema.prisma` for the executable source of truth)

Core relationship chain:

```
Company ─< Project ─< WBS (self-referencing tree)
                    ─< CostCode (self-referencing, ─ CostCategory)
                    ─< BOQItem ─< BOQRevisionLine (BOQ history)
                    ─< Budget ─< BudgetLine ─< BudgetRevision
                    ─< Variation
                    ─< ActualCostTransaction ─< CostAllocation (split across WBS/BOQ/CostCode)
                    ─< Commitment ─< CommitmentLine
                    ─< Accrual
                    ─< Subcontractor ─< Subcontract ─< PaymentCertificate
                    ─< Material ─< MaterialReceipt/Issue/Return/Consumption/Loss
                    ─< ManpowerEntry
                    ─< EquipmentEntry
                    ─< IndirectCostEntry
                    ─< FixedAsset ─< DepreciationEntry
                    ─< ProgressEntry
                    ─< ForecastEntry
                    ─< EVMSnapshot
                    ─< ReportingPeriod ─< ReportSnapshot
                    ─< Alert / Notification

User ─< UserRole >─ Role >─ RolePermission >─ Permission
AuditLog (polymorphic: entityType + entityId + old/new JSON)
Attachment (polymorphic: entityType + entityId)
```

Every cost-bearing entity (ActualCostTransaction, Commitment, Accrual,
ManpowerEntry, EquipmentEntry, IndirectCostEntry, Material transactions,
Subcontract, PaymentCertificate) carries the same coding footer:
`projectId, wbsId (nullable), boqItemId (nullable), costCodeId (nullable),
costCategoryId (nullable), currency, exchangeRate, netAmount, vatAmount,
grossAmount, status (DRAFT/SUBMITTED/REVIEWED/APPROVED/POSTED/REVERSED)`.
A transaction with no `costCodeId` is **UNALLOCATED** and is surfaced by the
Zero Check / Unallocated Cost report until `CostAllocation` rows are added.

Full DDL: `backend/prisma/schema.prisma` (60+ models, see file for exact
columns, indexes, and constraints).

## 3. Main User Roles

- Super Administrator — full access, user/role/permission management
- Project Manager
- Cost Control Manager
- Cost Engineer
- Quantity Surveyor
- Planning Engineer
- Accountant
- Procurement
- Storekeeper
- Commercial Manager
- Management / Viewer (read-only + approvals)

Roles are DB rows (`Role`), not enums, so admins can add roles.

## 4. Permission Matrix (module × action)

Actions: `view, create, edit, delete, approve, post, export, import, print,
review, reverse, manage_users, manage_settings`.

Stored as `RolePermission(roleId, module, action, allowed)` — fully
configurable at runtime from Admin → Roles. Seed data ships a sensible
starting matrix (e.g. Storekeeper: view/create on Materials & Storage only;
Cost Control Manager: full view/create/edit on Budget/Actual/Forecast plus
approve; Viewer: view + export only). Server middleware
(`requirePermission(module, action)`) enforces this on every route —
frontend hiding of buttons is a convenience, never the security boundary.

## 5. Module Structure

See NAVIGATION.md-equivalent in §7. Each backend module is
`src/modules/<name>/{routes.ts, service.ts, schema.ts}` and owns its Prisma
models, calculation helpers, and validation.

## 6. Calculation Engine (`backend/src/lib/calc/`)

- `allocation.ts` — validates 100% split rule, applies percentage/amount
  allocation of one transaction across many coding targets.
- `budget.ts` — Original → + Approved Variations → Revised → Current Budget
  (BAC) roll-ups by WBS/CostCode/BOQ.
- `costExposure.ts` — Actual + Committed(remaining) + Accrued = Cost Exposure.
- `evm.ts` — PV, EV (3 methods: manual %, quantity-based, weighted-BOQ), AC,
  CV, SV, CPI, SPI, TCPI.
- `forecast.ts` — ETC/EAC/VAC with 4 selectable formulas (configurable per
  project in `SystemSettings.eacFormula`): `AC+ETC`, `BAC/CPI`,
  `AC+(BAC-EV)`, `AC+((BAC-EV)/CPI)`; supports manual override (logged to
  AuditLog) and 3 scenarios (Most Likely/Optimistic/Worst Case).
- `variance.ts` — splits total cost variance into Quantity Variance and Rate
  Variance per BOQ line: `QtyVar = (BudgetQty-ActualQty)×BudgetRate`,
  `RateVar = (BudgetRate-ActualRate)×ActualQty`.
- `materialLoss.ts` — Allowed vs Actual waste %, excess quantity × rate =
  excess cost.
- `profitability.ts` — Forecast Revenue − Forecast Cost = Forecast Profit/Margin.
- `alerts.ts` — evaluates configurable thresholds (`AlertRule` table) against
  live calculation results and writes `Alert` rows.

All of the above are pure functions unit-tested against fixed inputs
(`backend/src/lib/calc/*.test.ts`) so every KPI is reproducible from raw
transactions — never computed ad hoc in a report or the frontend.

## 7. Main Navigation

Dashboard · Project Control (Setup, WBS, BOQ, Cost Codes, Budget,
Variations) · Cost (Actual Cost, Commitments, Accruals, Allocation, Expenses,
Indirect Cost) · Resources (Materials, Storage, Manpower, Equipment, Fixed
Assets) · Commercial (Subcontractors, Payment Certificates, Variations,
Deductions) · Progress & Forecast (Progress, Forecast, EVM, Scenarios) ·
Reports (Executive, Cost, BOQ, WBS, Materials, Subcontractors, Resources,
EVM, Profitability) · Administration (Users, Roles, Permissions, Audit
Trail, Settings, Import/Export).

## 8. Data Flow

```
Excel BOQ ──import──▶ BOQItem ──▶ BudgetLine (Qty × Rate) ──▶ Budget (BAC)
Invoices/POs ──▶ ActualCostTransaction ──[CostAllocation]──▶ WBS/BOQ/CostCode
Subcontracts ──▶ Commitment ──▶ PaymentCertificate ──▶ ActualCostTransaction
Site data ──▶ Accrual (work done, not yet invoiced)
Progress entries ──▶ EVM engine ──▶ PV/EV/AC/CPI/SPI ──▶ Forecast engine ──▶ EAC/ETC/VAC
All of the above ──▶ Dashboard aggregation ──▶ Report Snapshot (frozen at period cut-off)
Every number on Dashboard/Report ──drill-down──▶ CostCode ▶ BOQItem ▶ Transaction ▶ Attachment
```

## 9. Import / Export Strategy

- **Import**: Upload → parse (xlsx via `exceljs`) → preview first N rows →
  user maps Excel columns to system fields (mapping UI, saved per template)
  → server-side validation (missing/duplicate codes, invalid qty/rate,
  missing units) → error report (row-level) → commit only valid rows →
  import summary (inserted/skipped/failed). Implemented first for BOQ;
  same engine (`backend/src/lib/importEngine.ts`) is reused for Cost Codes,
  WBS, Actual Costs, Materials in later phases.
- **Export**: `exceljs` for formatted Excel (styled headers, frozen panes),
  `pdfkit` for branded PDF reports (logo, prepared/reviewed/approved-by,
  KPI tables, page numbers).

## 10. Reporting Architecture

`ReportingPeriod` (cut-off date, status Draft→Under Review→Approved→
Finalized) owns `ReportSnapshot` rows. Finalizing a period computes and
freezes the full KPI set (immutable JSON payload) — never recalculated
in place, enabling trend analysis and prior-period comparison without risk
of retroactive drift. Live (non-snapshot) reports run the calculation engine
against current data for "as-of-today" views.

## 11. Dashboard Wireframe

```
[Contract | Current Budget | Actual | Committed | EAC | VAC]   ← KPI row 1
[Progress % | CPI | SPI | Forecast Margin | Cost Variance]     ← KPI row 2
[Cost by Category (donut)]     [Cost by Work Package (bar)]    ← row 3
[Budget vs Actual vs Forecast (bar/line combo)]                ← row 4
[Top 10 Cost Overruns (table, drill-down)]                     ← row 5
[Alerts & Risks (colored list, Green/Yellow/Red/Black)]        ← row 6
```

## 12. Development Roadmap / Delivery Phases

- **Phase 1 (this delivery)**: Architecture, full DB schema, auth+RBAC,
  audit trail, calculation engine, and functional CRUD + calculations for:
  Project Setup, WBS, Cost Codes/Categories, BOQ (+ Excel import + revisions),
  Budget (+ revisions), Variations, Actual Cost (+ unallocated + allocation),
  Commitments, Accruals, Subcontractors, Materials (+ storage/consumption/
  loss), Manpower, Equipment, Indirect Costs, Progress (3 methods), EVM,
  Forecast/EAC/ETC, Dashboard, Alerts, core Reports (Excel export), demo data
  seed.
- **Phase 2**: ✅ Approval Center (backend `/approvals` module + frontend page,
  pending-count badge in the top bar) — a single place to Approve / Reject /
  Return-for-Correction pending Actual Costs, Budgets, Variations, Accruals,
  and Payment Certificates, with a required reason on reject/return, fully
  audit-logged.
  ✅ Reconciliation / Zero-Check dashboard (backend `/reconciliation` module +
  frontend page) — nine data-integrity checks (missing cost code/WBS on BOQ,
  unallocated costs, budget-vs-BOQ drift, negative material balances,
  over-certified commitments/subcontracts, negative accruals, inactive cost
  codes still posted against) rolled into one PASS/WARNING/ERROR status.
  ✅ Report Periods & Snapshots UI (backend already existed; added the
  frontend) — create a period, finalize it to freeze an immutable KPI
  snapshot, view any past snapshot.
  ✅ Forecast Scenarios (backend `/evm/scenarios` + panel on the EVM page) —
  Most Likely / Optimistic / Worst Case ETC/EAC/VAC/Profit/Margin, using a
  per-scenario manual override when set (via the existing forecast-override
  endpoint) or a heuristic variance band otherwise.
  Still queued: Taxes & Overhead module UI, full PDF report branding,
  remaining report templates, global search, notifications center.
- **Phase 3**: Primavera P6 XER import stub, Odoo/Power BI integration
  endpoints, mobile-optimized views, multi-company/multi-currency UI.

## 13. Reconciliation with existing Excel Cost Report

Excel sheet → system mapping (business logic reconstructed, not copied):

| Excel sheet | System equivalent |
|---|---|
| Budget Break-Down | BOQ + BudgetLine |
| WBS-I / WBS-D | WBS + IndirectCostEntry / ManpowerEntry |
| budget-cost | Executive Cost Report (calculation engine) |
| Analysis | Dashboard / Cost Analysis reports |
| Material Losses | Material Loss module (`materialLoss.ts`) |
| Storage | MaterialReceipt/Issue/Return (inventory ledger) |
| Expenses | Site Expenses (IndirectCostEntry, category=SITE_EXPENSE) |
| Fixed Assets | FixedAsset + DepreciationEntry (Phase 2) |
| Taxes & Overhead | SystemSettings.vatRate + IndirectCostEntry (overhead category) |
| Balance & Provision | Accrual + Provision |
| Work Package sheets | CostCode rollups filtered by Work Package tag |

`Reports → Reconciliation` (Phase 2) will show Excel Total vs System Total vs
Difference vs Status per sheet, per the reconciliation engine described in
requirement §58/§59/§71.
