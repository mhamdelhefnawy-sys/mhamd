/**
 * Minimal Primavera P6 .xer reader (§43/§44).
 *
 * The XER format is plain tab-delimited text: a `ERMHDR` header line, then
 * repeated table blocks of the form
 *   %T\t<TableName>
 *   %F\t<field1>\t<field2>\t...
 *   %R\t<value1>\t<value2>\t...   (one row per activity/relationship/etc.)
 *   ...
 * until the next `%T` or a trailing `%E`. That structure is simple enough
 * to parse for real (no CPM engine needed to just read it), so this is a
 * genuine reader — not a stub — for the tables the Practical P6 Lab needs:
 * PROJECT, PROJWBS, CALENDAR, TASK (activities) and TASKPRED (relationships).
 *
 * IMPORTANT — what this is NOT: a Primavera scheduling engine. Every date,
 * float, and critical-path flag read here is the value P6 itself last
 * calculated and stored in the file. This module never recomputes CPM; it
 * only reads and diagnoses what's already there. Label everything derived
 * from it as an analytical result of this platform, not a "P6 result" —
 * see docs/XER_INTEGRATION.md.
 */

export interface XerTable {
  name: string;
  fields: string[];
  rows: Record<string, string>[];
}

export function parseXerTables(content: string): Record<string, XerTable> {
  const lines = content.split(/\r?\n/);
  const tables: Record<string, XerTable> = {};
  let current: XerTable | null = null;

  for (const line of lines) {
    if (!line) continue;
    const cells = line.split('\t');
    const tag = cells[0];

    if (tag === '%T') {
      const name = cells[1]?.trim();
      current = { name, fields: [], rows: [] };
      tables[name] = current;
    } else if (tag === '%F' && current) {
      current.fields = cells.slice(1).map((f) => f.trim());
    } else if (tag === '%R' && current) {
      const values = cells.slice(1);
      const row: Record<string, string> = {};
      current.fields.forEach((f, i) => (row[f] = values[i] ?? ''));
      current.rows.push(row);
    }
    // %E (end) and ERMHDR header are not needed for diagnostics — skipped.
  }

  return tables;
}

export interface ParsedSchedule {
  projectName: string | null;
  activityCount: number;
  relationshipCount: number;
  calendarCount: number;
  wbsCount: number;
  activities: Array<{
    taskCode: string;
    taskName: string;
    taskType: string;
    statusCode: string;
    totalFloatHr: number | null;
    freeFloatHr: number | null;
    remainDurationHr: number | null;
    targetDurationHr: number | null;
    constraintType: string | null;
    physicalPct: number | null;
    hasPredecessor: boolean;
    hasSuccessor: boolean;
  }>;
}

const num = (v: string | undefined) => (v && v.trim() !== '' ? Number(v) : null);

export function toParsedSchedule(tables: Record<string, XerTable>): ParsedSchedule {
  const proj = tables['PROJECT']?.rows[0];
  const tasks = tables['TASK']?.rows ?? [];
  const preds = tables['TASKPRED']?.rows ?? [];

  const predecessorOf = new Set(preds.map((p) => p.task_id));
  const successorOf = new Set(preds.map((p) => p.pred_task_id));

  const activities = tasks.map((t) => ({
    taskCode: t.task_code,
    taskName: t.task_name,
    taskType: t.task_type,
    statusCode: t.status_code,
    totalFloatHr: num(t.total_float_hr_cnt),
    freeFloatHr: num(t.free_float_hr_cnt),
    remainDurationHr: num(t.remain_drtn_hr_cnt),
    targetDurationHr: num(t.target_drtn_hr_cnt),
    constraintType: t.cstr_type || null,
    physicalPct: num(t.phys_complete_pct),
    hasPredecessor: predecessorOf.has(t.task_id),
    hasSuccessor: successorOf.has(t.task_id),
  }));

  return {
    projectName: proj?.proj_short_name ?? null,
    activityCount: tasks.length,
    relationshipCount: preds.length,
    calendarCount: tables['CALENDAR']?.rows.length ?? 0,
    wbsCount: tables['PROJWBS']?.rows.length ?? 0,
    activities,
  };
}
