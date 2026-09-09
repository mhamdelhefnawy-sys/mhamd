# Primavera XER Integration — Architecture & Current Status (§43-44)

## What's implemented now
`src/lib/xer/parseXer.ts` is a **real, working** reader for the `.xer` text
format (tab-delimited `%T`/`%F`/`%R` table blocks — no CPM re-implementation
needed to read it). It currently reads `PROJECT`, `PROJWBS`, `CALENDAR`,
`TASK`, and `TASKPRED`. `src/lib/xer/diagnostics.ts` runs a set of
diagnostics purely from those parsed values:

- Open ends (activities with no predecessor and/or successor)
- Negative float / high float (> 44 working days)
- Excessive / hard constraints
- Long durations (> 20 days)
- % critical activities, % constrained activities

The **Practical P6 Lab** (`/practical-p6`) exposes this: upload a `.xer`,
get the counts and flagged-activity tables immediately. Every upload is
recorded in the `ScheduleImport` table (file name, project name, importer,
a JSON summary) for history.

## What this deliberately does NOT do (and says so in the UI)
Every float, date, and criticality value shown is **P6's own last-computed
value**, read straight out of the file — this module never re-runs a
forward/backward pass. Per §43's explicit instruction, the platform never
claims Primavera scheduling-engine compatibility it hasn't built and
validated. Two diagnostics are explicitly marked "not applicable" rather
than faked:
- **Out-of-sequence progress detection** — needs a live CPM recalculation
  against actual dates, not a static read.
- **True driving-relationship / longest-path tracing** — needs a full
  forward/backward pass; the diagnostics use `total_float_hr_cnt` (as
  computed by P6) as a proxy for criticality instead.

Anywhere the UI or a report shows one of these numbers, it is labeled an
**"analytical result"** of this platform, distinct from a certified P6
scheduling determination — see the scope note on `/practical-p6`.

## Roadmap for full XER support (not yet built)
The schema and parser are structured so these are additive, not a rewrite:

1. **Resources & costs** — read `RSRC`, `TASKRSRC`, `ACTVCODE` tables;
   extend `ParsedSchedule` with resource/cost loading per activity.
2. **Baselines** — P6 exports a baseline as its own `PROJECT` block (a
   separate `proj_id`) inside the same or a companion XER; extend the
   importer to detect and store a baseline `ScheduleImport` linked to a
   current one, then compute start/finish/duration/float variance the same
   way the Baseline / Schedule Comparison question category expects
   candidates to reason about it.
3. **Multi-project XERs** — `parseXerTables` already returns every table's
   full row set; a multi-project file just means filtering `TASK`/`TASKPRED`
   rows by `proj_id` per project instead of assuming one.
4. **True schedule diagnostics** (DCMA-14-style, done properly) — once
   resources/costs are in, add logic density, missing-logic, and BEI/CPLI
   checks; continue to present every threshold as one methodology among
   several (never universally mandatory), matching how the Schedule Quality
   question category already treats this.
5. **Schedule comparison ("Claim Digger"-style)** — diff two `ScheduleImport`
   records (by matching `task_code`) for date/float/logic changes between
   two schedule updates.

None of this requires a new top-level architecture — it's the same
`ScheduleImport` table, the same `parseXerTables` → `toParsedSchedule` →
diagnostics pipeline, extended with more tables and more diagnostic
functions.
