# Deployment

## Moving from SQLite to PostgreSQL
1. Provision a Postgres 14+ instance.
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to the Postgres connection string.
4. `npx prisma migrate dev --name postgres-migration` (or `migrate deploy`
   in CI/CD) to (re)create the schema against Postgres.
5. Re-run `npm run db:seed` against the new database, or export/import the
   question bank via `GET /api/questions/export?format=json` from the old
   SQLite instance and `npm run questions:import` into the new one.
6. Optional: promote the "enum-like" `String` columns and JSON-text
   columns to native `enum`/`Json` types now that the connector supports
   them — see the header comment in `prisma/schema.prisma` for the exact
   list. This is purely a schema-hardening step; the stored values already
   match what a native enum/Json column would hold, so no data migration is
   required.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | SQLite file path in dev; Postgres connection string in production. |
| `AUTH_SECRET` | yes | ≥16 chars, used to sign session JWTs (HS256 via `jose`). Rotate this and every session is invalidated. |
| `NODE_ENV` | recommended | `production` enables secure cookies. |

## Running in production

```bash
npm run build
npm run start   # next start, listens on PORT (default 3000)
```

Standard Next.js 14 App Router deployment — works on any Node.js host
(a container, a VM, or a Next.js-aware platform). No custom server is used.
Session auth is a signed HTTP-only cookie (not database-backed), so the app
is stateless and horizontally scalable behind a load balancer as long as
every instance shares the same `AUTH_SECRET` and points at the same
database.

## PDF generation
`@react-pdf/renderer` renders PDFs in pure JavaScript (no headless browser
dependency), so report PDF generation works in any standard Node.js runtime
without extra system packages.

## What to harden before a real production launch
This build prioritizes correctness, content quality, and completeness of
the specified feature set over production hardening polish. Before a real
launch, add: rate limiting on `/api/auth/login`, structured request
logging, a background job runner instead of the current inline "materialize
next adaptive question" call inside the answer-submission request (fine at
demo scale, but move to a queue under heavy concurrent load), CORS
configuration if the API is ever called cross-origin, and automated backups
for the production database.
