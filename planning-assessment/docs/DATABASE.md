# Database Structure

Source of truth: `prisma/schema.prisma`. This document explains the shape and
the reasoning, not just the columns.

## Provider & portability

SQLite is used for zero-config dev/demo (`prisma/dev.db`). Every column type
used (`String`, `Int`, `Float`, `Boolean`, `DateTime`) is portable to
PostgreSQL — moving to production is a `provider = "postgresql"` +
`DATABASE_URL` change, nothing else (see `docs/DEPLOYMENT.md`).

Two things are deliberately **not** native types, because SQLite's Prisma
connector (as of the pinned Prisma version) supports neither natively:

- **Enums.** Role, question type, difficulty-adjacent strings, assessment
  mode, etc. are plain `String` columns whose allowed values live in
  `src/lib/constants.ts` and are enforced by Zod at the API boundary. On
  Postgres these can be promoted to native `enum` types with no data
  migration (the stored values are already the enum member names).
- **JSON columns.** Arrays and structured objects (options, follow-up
  questions, scoring rubrics, given data, etc.) are stored as JSON text in
  `String` columns and (de)serialized through `src/lib/json.ts`
  (`toJson`/`fromJson`) — never ad hoc `JSON.parse`/`stringify` scattered
  through the app. On Postgres these can become native `Json` columns.

## Entity map

```
User ──< Candidate (1:1, optional — a Candidate may or may not have a login)
User ──< Question (author, reviewer)   ──< QuestionVersion (audit trail)
User ──< Interview (interviewer)       ──< InterviewNote, InterviewFollowUp
User ──< Assessment (createdBy)        ──< Report (generatedBy)

Category ──< Question >── Competency
Question ──< QuestionOption
Question ──< QuestionTagLink
Question ──< QuestionRelation >── Question   (self-referencing "knowledge graph", §38)
Question ──< QuestionFlagRecord              (quality review workflow, §36)

Candidate ──< Assessment ──< AssessmentQuestion ── Question
                          └─< Score (OVERALL / COMPETENCY / DIFFICULTY / CATEGORY rollups)
              AssessmentQuestion ──1:1── Answer

Candidate ──< Interview ──1:1── Assessment (an interview IS an assessment run,
              scored the same way, just interviewer-driven instead of self-serve)

Candidate ──< Report (frozen JSON snapshot + PDF-on-demand)

LevelThreshold  — admin-editable classification ladder (§29)
Settings        — free-form key/value store for anything not worth its own table
AuditLog        — polymorphic (entityType/entityId) change log
ScheduleImport  — Practical P6 Lab XER upload records (§43/§44)
Project         — reference list of demo/real project contexts
```

## Why Category ≠ Competency

Every `Question` carries **both**:
- `categoryId` → one of the 25 topic categories from §3 (e.g. "CPM / Critical
  Path / Float", "EOT / Claims") — used for content organization, admin
  filtering, and the §3 distribution targets.
- `competencyId` → one of the **8 weighted scoring groups** from §28
  (Planning & CPM, Primavera P6, Schedule Analysis, Project Controls/EVM,
  Delay/Claims, Construction Methodology, Analytical Thinking,
  Management/Communication/Ethics) — used for weighted scoring and the
  candidate competency profile.

`subcategory` and `skill` are free-text, finer-grained than category —
matching the question data model's `category → subcategory → competency →
skill` hierarchy.

## Scoring data flow

1. `Answer` rows store the raw candidate response + auto/rubric scores.
2. `computeAssessmentScores()` (`src/lib/engine/results.ts`) aggregates every
   `Answer` in a completed `Assessment` into `Score` rows: one `OVERALL`,
   one `COMPETENCY` per touched competency, one `DIFFICULTY` per level 1-5,
   one `CATEGORY` per touched category.
3. Candidate profile pages, reports, and analytics all read `Score` rows —
   none of them recompute scoring logic themselves.

## Content governance (§52)

Question **content** (the 25 fields), scoring **logic**
(`src/lib/engine/*`), the **UI** (`src/app/`, `src/components/`), and the
**assessment engine** (question selection, adaptivity) are kept in separate
modules on purpose — the database schema is what makes that separation
possible: nothing about how a question is scored is hard-coded into the
question's own row.
