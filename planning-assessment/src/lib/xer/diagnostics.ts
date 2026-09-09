import type { ParsedSchedule } from './parseXer';

const HOURS_PER_DAY = 8; // standard P6 8hr/day calendar assumption for the day-count diagnostics below

export interface ScheduleDiagnostics {
  totalActivities: number;
  openEnds: { taskCode: string; taskName: string; reason: string }[];
  negativeFloat: { taskCode: string; taskName: string; totalFloatDays: number }[];
  highFloat: { taskCode: string; taskName: string; totalFloatDays: number }[];
  excessiveConstraints: { taskCode: string; taskName: string; constraintType: string }[];
  longDurations: { taskCode: string; taskName: string; durationDays: number }[];
  criticalCount: number;
  criticalPct: number;
  constraintPct: number;
  notApplicable: string[];
}

/**
 * Diagnostic thresholds are configurable defaults inspired by common
 * DCMA-14-style checks, presented as ONE possible methodology — never as a
 * universally mandatory pass/fail bar (see the platform's own Schedule
 * Quality question category for the same caveat applied to the question
 * bank). Every number below is this platform's analytical judgment call,
 * not a Primavera-computed verdict.
 */
export function runScheduleDiagnostics(schedule: ParsedSchedule): ScheduleDiagnostics {
  const acts = schedule.activities.filter((a) => a.taskType !== 'TT_WBS');

  const openEnds = acts
    .filter((a) => !a.hasPredecessor || !a.hasSuccessor)
    .filter((a) => !['TT_Mile', 'TT_FinMile'].includes(a.taskType) || (!a.hasPredecessor && !a.hasSuccessor))
    .map((a) => ({
      taskCode: a.taskCode,
      taskName: a.taskName,
      reason: !a.hasPredecessor && !a.hasSuccessor ? 'No predecessor or successor' : !a.hasPredecessor ? 'No predecessor' : 'No successor',
    }));

  const negativeFloat = acts
    .filter((a) => a.totalFloatHr != null && a.totalFloatHr < 0)
    .map((a) => ({ taskCode: a.taskCode, taskName: a.taskName, totalFloatDays: Math.round(((a.totalFloatHr as number) / HOURS_PER_DAY) * 10) / 10 }));

  const highFloat = acts
    .filter((a) => a.totalFloatHr != null && a.totalFloatHr / HOURS_PER_DAY > 44)
    .map((a) => ({ taskCode: a.taskCode, taskName: a.taskName, totalFloatDays: Math.round(((a.totalFloatHr as number) / HOURS_PER_DAY) * 10) / 10 }));

  const excessiveConstraints = acts
    .filter((a) => a.constraintType && !['CS_ALAP'].includes(a.constraintType))
    .map((a) => ({ taskCode: a.taskCode, taskName: a.taskName, constraintType: a.constraintType as string }));

  const longDurations = acts
    .filter((a) => a.remainDurationHr != null && a.remainDurationHr / HOURS_PER_DAY > 20)
    .map((a) => ({ taskCode: a.taskCode, taskName: a.taskName, durationDays: Math.round(((a.remainDurationHr as number) / HOURS_PER_DAY) * 10) / 10 }));

  const criticalCount = acts.filter((a) => a.totalFloatHr != null && a.totalFloatHr <= 0).length;

  return {
    totalActivities: acts.length,
    openEnds,
    negativeFloat,
    highFloat,
    excessiveConstraints,
    longDurations,
    criticalCount,
    criticalPct: acts.length ? Math.round((criticalCount / acts.length) * 1000) / 10 : 0,
    constraintPct: acts.length ? Math.round((excessiveConstraints.length / acts.length) * 1000) / 10 : 0,
    notApplicable: [
      'Out-of-sequence progress detection requires re-running the CPM engine against actual dates and is not available from a static XER read.',
      'Driving-relationship / true longest-path tracing requires a full forward/backward pass and is not attempted here — total_float_hr_cnt as last computed by P6 is used instead.',
    ],
  };
}
