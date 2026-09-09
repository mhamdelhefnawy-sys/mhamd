# Administrator Guide

## Roles (§41)
- **Admin** — full access, including user management, competency weights,
  level thresholds, and question deletion.
- **Assessment Manager** — creates assessments/interviews for candidates,
  manages the question bank (create/edit, not delete), views reports and
  analytics.
- **Interviewer** — conducts Interview Mode sessions, scores answers, sees
  full answer keys; read-only on candidates/reports.
- **Candidate** — takes their own assessments only; never sees answer keys,
  rubrics, hidden follow-ups, or other candidates' data (enforced
  server-side in `src/lib/engine/sanitize.ts`, not just hidden in the UI).
- **Viewer** — read-only across candidates, reports, and analytics.

## Question Bank (`/question-bank`, §33)
- Filter by category, competency, difficulty, career level, question type,
  status.
- Bulk-select rows for **Activate / Deactivate / Archive / Duplicate /
  Delete**.
- Every edit is versioned (`QuestionVersion` — a full snapshot of the prior
  state, visible on the question's edit page).
- **Quality flags** (§36): any reviewer can raise `AMBIGUOUS / INCORRECT /
  TOO_EASY / TOO_DIFFICULT / DUPLICATE / NEEDS_REVIEW` on a question, which
  moves it to `REVIEW` status; an Admin/Manager resolves the flag from the
  same panel.
- **Import / Export** (§34, see `docs/IMPORT_EXPORT_GUIDE.md`).

## Competency Framework (`/competencies`, §28-29)
- Edit the 8 competency weights (must sum to 100) and which are "critical"
  for level-classification gating.
- Edit the minimum overall score required for each classification level.
  (Per-level critical-competency floors are derived automatically as
  `minOverallScore − 15` by default — edit `LevelThreshold` rows directly in
  the database for finer control, or extend the settings UI.)

## Analytics (`/analytics`, §51)
Candidate/competency/level performance, most-frequently-missed questions,
and items flagged as possibly too easy (≥92% correct, n≥5) or too hard
(≤15% correct, n≥5) — a starting point for question-bank quality review, not
a full psychometric IRT analysis.

## Data Integrity (`/admin`, §47)
"Run Check" executes a live pass for: duplicate question codes, auto-scored
questions missing a correct answer or a correctly-flagged option,
open-ended questions missing a rubric, questions missing both an
explanation and an expected answer, competency weights not summing to 100,
categories with zero questions, and orphaned answer rows.

## Users (`/admin/users`)
Create staff accounts (Admin/Assessment Manager/Interviewer/Viewer) with a
role and an optional password (defaults to the platform demo password if
left blank — change it before handing out real accounts). Candidate
accounts are created automatically when a Candidate record with a matching
email is set up via `/candidates/new`.
