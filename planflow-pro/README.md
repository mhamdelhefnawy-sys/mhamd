# PlanFlow Pro (Phase 1 / MVP)

An independent Excel add-in for turning a BOQ into a resource/cost-loaded
construction schedule exportable to Primavera P6 (XER), built fresh in
C# / .NET / Excel-DNA — no code, assets, or licensing mechanisms from any
third-party scheduling tool were copied.

This repository currently implements **Phase 1 (MVP)** of the staged plan
in the original brief: Project Setup, Load/Validate BOQ, Locations, WBS,
mock-rules Generate Activities, Mapping, Manpower/Resources, a first-cut
XER export, and validation — plus a real xUnit test suite for the engine.
Phase 2 (AI review/mapping, Cost Stages, Engineering/Procurement chains,
Calendar library, Logic suggestions, Project Timeline/forward pass) and
Phase 3 (full XER import, reference linking, resource fix, split progress,
dashboards, licensing) are **not built yet** — see `docs/STATUS.md`.

## Why this needs a Windows machine

This code was written in a Linux sandbox that has **no .NET SDK, no
internet access to install one, and no Excel** — so none of it has been
compiled, run, or tested in this session. `PlanFlow.Core` targets
`net48;net6.0` and has no Excel dependency, so once you have the .NET SDK
it should build and its tests should run on any OS. `PlanFlow.ExcelAddIn`
targets `net48`, depends on Excel-DNA and `Microsoft.Office.Interop.Excel`,
and can only be built and exercised on Windows with Excel installed.

## Layout

```
PlanFlow.sln
src/
  PlanFlow.Core/         Framework-agnostic domain model + business logic (testable, no Excel dependency)
  PlanFlow.ExcelAddIn/   Excel-DNA ribbon ("PlanFlow Pro" tab) + Excel Object Model glue
tests/
  PlanFlow.Core.Tests/   xUnit tests for Core
docs/
  ARCHITECTURE.md        Data model, sheet contracts, phase plan
  STATUS.md              What's implemented vs. still open
```

## Build & test (on Windows, once .NET is installed)

```
dotnet restore
dotnet test tests/PlanFlow.Core.Tests
dotnet build src/PlanFlow.ExcelAddIn   # produces PlanFlow.ExcelAddIn-AddIn64.xll via Excel-DNA
```

Then in Excel: Options → Add-ins → Manage Excel Add-ins → Browse to the
generated `.xll` and enable it. A "PlanFlow Pro" ribbon tab appears.

## Core design rules carried through the code

- Every AI/mapping/generation result carries a `ReviewStatus`
  (Suggested/Reviewed/Approved/Rejected/Manual) — nothing is applied to
  the construction plan without an explicit "Apply" step.
- BOQ→activity mapping that can't be resolved goes to an exceptions list,
  never a silently-created activity.
- Splits and mapping preserve quantity and cost exactly (`CostConservation`,
  tested against rounding edge cases).
- Activity IDs are generated through one guarded sequence and
  re-validated for uniqueness before XER export.
- XER export is blocked while `XerExportValidator` reports any error
  (duplicate IDs, missing WBS, dangling relationships, self-links,
  circular logic) — mirrors the spec's mandatory pre-export checks.
- `AuditLog` records user/operation/affected-row-count for every mutating
  ribbon command; `BackupService` snapshots the workbook file before
  applying a plan or exporting.
