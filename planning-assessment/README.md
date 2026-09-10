# Planning Engineer Competency Assessment Platform

The complete Planning, Primavera P6 & Project Controls competency
assessment ecosystem — evaluating candidates from Junior Planning Engineer
through Planning Manager / Project Controls Manager on what they actually
understand, not just what they can recite.

This is a self-contained Next.js 14 (App Router) + TypeScript + Prisma
application, independent of any other project in this repository.

## What's here

- **Professional question bank** — 705 original, structured questions
  (see `content/questions/*.json`, loaded by the seed script) spanning 25
  categories: CPM/Float, Primavera P6 Fundamentals & Advanced, Schedule
  Logic, Constraints, Calendars, Progress Updating, Baselines, Schedule
  Quality, Resources, Cost Loading, EVM, Productivity, Recovery/
  Acceleration, Delay Analysis, EOT/Claims, Time Impact Analysis, Change
  Orders, Construction Methodology, Project Controls, Risk, Reporting,
  Professional Ethics, and a dedicated **Planning Paradoxes & Trap
  Scenarios** category (§9). ≥70% of questions are
  scenario/practical/analytical/troubleshooting/decision-making, not plain
  recall — see `content/QUESTION_SCHEMA.md` for the full authoring spec.
- **Adaptive assessment engine** — 9 modes (Quick/Standard/Full/
  Certification/Interview/Senior-Manager/Practical-P6/Training/Custom),
  live per-competency difficulty adaptation, anti-memorization
  randomization.
- **Interview Mode** — interviewer console with live rubric scoring,
  answer-key reveal, and a follow-up-question engine.
- **Weighted competency scoring + gated level classification** — a high
  overall score cannot buy a classification if a critical competency is
  weak (see `docs/SCORING_METHODOLOGY.md`).
- **Candidate profiles, reports, and PDF export.**
- **Full admin question-bank management** — CRUD, bulk actions, JSON/CSV
  import/export, versioning, quality-review flags, analytics (item
  difficulty, most-missed questions, competency/level performance).
- **Practical P6 Lab** — a real (not stubbed) `.xer` file reader with
  schedule diagnostics (open ends, negative/high float, excessive
  constraints), honestly scoped — see `docs/XER_INTEGRATION.md`.
- **Bilingual UI** — English/Arabic with RTL layout switching
  (`src/lib/i18n/`); question content carries `questionAr`/`textAr` fields
  ready for full Arabic content at scale.
- **Role-based access** — Admin, Assessment Manager, Interviewer, Candidate,
  Viewer, enforced server-side (`src/lib/auth/guards.ts`,
  `src/lib/engine/sanitize.ts`), not just hidden in the UI.

## Quick start

See `docs/INSTALLATION.md`. Short version:

```bash
npm install
cp .env.example .env   # set AUTH_SECRET
npx prisma migrate dev --name init   # creates the DB, runs the seed
npm run dev
```

## Documentation

| Doc | Covers |
|---|---|
| `docs/INSTALLATION.md` | Setup, demo accounts, useful scripts |
| `docs/DATABASE.md` | Schema, entity map, why category ≠ competency |
| `content/QUESTION_SCHEMA.md` | The question data model + authoring rules |
| `docs/SCORING_METHODOLOGY.md` | How answers become scores, competency roll-ups, level gating, adaptivity |
| `docs/COMPETENCY_METHODOLOGY.md` | Why the 8 competency groups and critical-gating exist |
| `docs/ADMIN_GUIDE.md` / `CANDIDATE_GUIDE.md` / `INTERVIEWER_GUIDE.md` | Per-role usage |
| `docs/IMPORT_EXPORT_GUIDE.md` | JSON/CSV question bank import/export |
| `docs/XER_INTEGRATION.md` | What the Practical P6 Lab does today vs. the roadmap |
| `docs/DEPLOYMENT.md` | Moving to Postgres, environment variables, production notes |

## Architecture at a glance

```
Next.js 14 App Router (src/app) ── Route Handlers (src/app/api) ── Prisma ── SQLite (dev) / PostgreSQL (prod)
                │
                ├── src/lib/engine/     scoring, adaptive selection, classification, report building — pure logic, DB-aware but UI-agnostic
                ├── src/lib/auth/       session (jose/HS256 JWT cookie) + role guards
                ├── src/lib/i18n/       EN/AR dictionaries + RTL provider
                ├── src/lib/xer/        .xer parser + schedule diagnostics
                └── src/lib/validation/ Zod schema shared by seed, CLI import, and the admin import API
```

Content (question data), scoring logic, the UI, and the assessment engine
are kept in separate modules by design (§52) — the question bank can grow
from 500 to 5,000+ questions, or the scoring formulas can change, without
touching the other layers.

## Honesty notes (things this build does NOT claim)

- The **written-answer heuristic score** is a keyword/concept-detection
  draft, not AI grading — always overridable by a human, always labeled as
  such. See `docs/SCORING_METHODOLOGY.md §1`.
- The **Practical P6 Lab** reads and diagnoses a `.xer` file's *already
  P6-computed* values; it does not re-implement Primavera's scheduling
  engine. See `docs/XER_INTEGRATION.md`.
- Arabic content is fully wired end-to-end (UI chrome, RTL, per-question
  `questionAr` field) but the seeded question bank itself is authored in
  English first, consistent with keeping technical planning terminology
  (Total Float, Data Date, Out-of-Sequence, …) unambiguous — see the note in
  `content/QUESTION_SCHEMA.md`.
