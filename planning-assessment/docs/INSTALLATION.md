# Installation

## Prerequisites
- Node.js 18.18+ (Node 20/22 recommended)
- npm 9+

## Steps

```bash
cd planning-assessment
npm install

cp .env.example .env
# Edit .env: set AUTH_SECRET to a long random string
#   openssl rand -hex 32

npx prisma migrate dev --name init   # creates prisma/dev.db and applies the schema
# The seed runs automatically after migrate (configured via the "prisma.seed"
# key in package.json). To re-seed later without a new migration:
npm run db:seed

npm run dev                           # http://localhost:3000
```

Log in with any of the demo accounts (password for all: `Passw0rd!123`):

| Role | Email |
|---|---|
| Administrator | `admin@peassess.io` |
| Assessment Manager | `manager@peassess.io` |
| Interviewer | `interviewer@peassess.io` |
| Viewer | `viewer@peassess.io` |
| Candidate (strong P6, weak Delay Analysis) | `candidate.strong@peassess.io` |
| Candidate (strong Construction, weaker CPM/P6) | `candidate.gap@peassess.io` |
| Candidate (strong Planning, weak EVM) | `candidate.evm-gap@peassess.io` |
| Candidate (senior-level across most competencies) | `candidate.senior@peassess.io` |

## Production build

```bash
npm run build
npm run start
```

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run questions:validate` | Validates every file in `content/questions/*.json` against the question schema and reports category coverage vs. the §3 minimums. |
| `npm run questions:import -- path/to/file.json` | CLI bulk import (same validation/upsert path as the seed step and the admin UI). |
| `npm run prisma:migrate` | Create/apply a new migration after editing `prisma/schema.prisma`. |
| `npm run db:seed` | Re-run the seed (idempotent — safe to re-run any time). |

See `docs/DEPLOYMENT.md` for moving to PostgreSQL and a real deployment target.
