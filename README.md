# Construction Project Cost Control & Management System

A full-stack Project Cost Control system for contracting companies — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design (ERD, roles,
permission matrix, calculation engine, roadmap).

- `backend/` — Node.js + TypeScript + Express + Prisma + PostgreSQL API
- `frontend/` — Next.js 14 + TypeScript + Tailwind + React Query + Recharts

## Quick start

### 1. Database

Either run Postgres via Docker:

```bash
docker compose up -d postgres
```

...or point `DATABASE_URL` at any existing PostgreSQL 14+ instance.

### 2. Backend

```bash
cd backend
cp .env.example .env      # adjust DATABASE_URL / JWT_SECRET if needed
npm install
npx prisma migrate deploy # applies the schema
npm run seed               # loads a realistic demo project
npm run dev                 # http://localhost:4000
```

Run the calculation-engine unit tests any time with `npm test`.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

### 4. Log in

Open `http://localhost:3000/login`.

| Role | Email | Password |
|---|---|---|
| Super Administrator | `admin@albina.sa` | `Passw0rd!123` |
| Cost Control Manager | `ccm@albina.sa` | `Passw0rd!123` |
| Cost Engineer | `engineer@albina.sa` | `Passw0rd!123` |
| Storekeeper | `store@albina.sa` | `Passw0rd!123` |
| Management / Viewer | `viewer@albina.sa` | `Passw0rd!123` |

The seed script creates one demo project ("Al-Noor Residential Towers")
with a full WBS, cost codes, BOQ, budget, actual costs, commitments,
accruals, subcontractors, materials with a waste/loss example, manpower,
equipment, indirect costs, and progress entries — enough to exercise every
Phase 1 module end to end.

## What's implemented (Phase 1)

Auth + configurable RBAC, audit trail, and a server-side calculation engine
(EVM, EAC/ETC/VAC with 4 selectable formulas, quantity/rate variance,
material loss, cost allocation, cost exposure, profitability), plus
functional UI + API for: Project Setup, WBS, Cost Codes/Categories, BOQ
(manual + Excel import with column mapping/validation + revision history),
Budget/Variations, Actual Cost (with allocation and unallocated-cost
handling), Commitments, Accruals, Subcontractors, Materials & Storage
(with automatic waste alerts), Manpower, Equipment, Indirect Costs, Fixed
Assets, Progress (3 methods), EVM & Forecast (with manual override and
trend snapshots), Dashboard, Alerts, Reports (Excel + PDF export), and
Admin (Users/Roles/Permission matrix/Audit trail).

See `ARCHITECTURE.md` §12 for what's queued in Phase 2/3.
