import { CLASSIFICATION_LEVELS, type ClassificationLevel, type CompetencyGroupCode } from '@/lib/constants';
import { CRITICAL_COMPETENCY_CODES } from './competencies';

export type { ClassificationLevel };

export interface ThresholdRow {
  level: ClassificationLevel;
  order: number;
  minOverallScore: number;
  minCriticalCompetencyScore: Partial<Record<CompetencyGroupCode, number>>;
}

/**
 * Default classification ladder (§29). Overall-score gates are necessary
 * but not sufficient: a candidate can only be classified at a level if
 * EVERY critical competency (Planning & CPM, Primavera P6, Schedule
 * Analysis, Delay/Claims — see COMPETENCY_GROUPS.isCritical) also clears
 * that level's minimum. This is what stops a high total score with one
 * weak critical competency from earning a Senior classification.
 * Admin-editable at runtime via the LevelThreshold table / Settings UI.
 */
export function defaultThresholds(): ThresholdRow[] {
  const rows: Array<[ClassificationLevel, number, number]> = [
    ['BELOW_JUNIOR', 0, 0],
    ['JUNIOR', 1, 35],
    ['JUNIOR_PLUS', 2, 45],
    ['PLANNING_ENGINEER', 3, 55],
    ['PLANNING_ENGINEER_PLUS', 4, 63],
    ['SENIOR_PLANNING_ENGINEER', 5, 71],
    ['SENIOR_PLUS', 6, 77],
    ['LEAD_PLANNING_ENGINEER', 7, 83],
    ['PROJECT_CONTROLS_LEAD', 8, 86],
    ['PLANNING_MANAGER', 9, 90],
    ['PROJECT_CONTROLS_MANAGER', 10, 93],
  ];
  return rows.map(([level, order, minOverallScore]) => ({
    level,
    order,
    minOverallScore,
    // Critical-competency floor rises with level; below Planning Engineer level, no gating is applied.
    minCriticalCompetencyScore: order <= 2 ? {} : Object.fromEntries(
      CRITICAL_COMPETENCY_CODES.map((c) => [c, Math.max(0, minOverallScore - 15)]),
    ),
  }));
}

export interface ClassificationResult {
  level: ClassificationLevel;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  overallScore: number;
  gatingCompetency: CompetencyGroupCode | null; // the critical competency that capped the result, if any
  nextLevel: ClassificationLevel | null;
  gapToNextLevel: { overall: number; competencies: Partial<Record<CompetencyGroupCode, number>> } | null;
}

export function classifyCandidate(params: {
  overallScore: number;
  competencyScores: Partial<Record<CompetencyGroupCode, number>>;
  questionsAnswered: number;
  thresholds?: ThresholdRow[];
}): ClassificationResult {
  const { overallScore, competencyScores, questionsAnswered } = params;
  const thresholds = [...(params.thresholds ?? defaultThresholds())].sort((a, b) => b.order - a.order);

  let achieved: ThresholdRow = thresholds[thresholds.length - 1];
  let gatingCompetency: CompetencyGroupCode | null = null;

  for (const t of thresholds) {
    if (overallScore < t.minOverallScore) continue;
    const failing = (Object.entries(t.minCriticalCompetencyScore) as [CompetencyGroupCode, number][]).find(
      ([code, min]) => (competencyScores[code] ?? 0) < min,
    );
    if (failing) continue; // overall score qualifies, but a critical competency gates it down
    achieved = t;
    break;
  }

  // Determine which competency (if any) is the binding constraint just above the achieved level.
  const higherLevels = thresholds.filter((t) => t.order === achieved.order + 1);
  if (higherLevels.length && overallScore >= higherLevels[0].minOverallScore) {
    const failing = (Object.entries(higherLevels[0].minCriticalCompetencyScore) as [CompetencyGroupCode, number][]).find(
      ([code, min]) => (competencyScores[code] ?? 0) < min,
    );
    if (failing) gatingCompetency = failing[0];
  }

  const sortedAsc = [...thresholds].sort((a, b) => a.order - b.order);
  const idx = sortedAsc.findIndex((t) => t.level === achieved.level);
  const next = sortedAsc[idx + 1] ?? null;

  const confidence: ClassificationResult['confidence'] =
    questionsAnswered >= 40 ? 'HIGH' : questionsAnswered >= 15 ? 'MEDIUM' : 'LOW';

  return {
    level: achieved.level,
    confidence,
    overallScore,
    gatingCompetency,
    nextLevel: next?.level ?? null,
    gapToNextLevel: next
      ? {
          overall: Math.max(0, next.minOverallScore - overallScore),
          competencies: Object.fromEntries(
            (Object.entries(next.minCriticalCompetencyScore) as [CompetencyGroupCode, number][])
              .map(([code, min]) => [code, Math.max(0, min - (competencyScores[code] ?? 0))])
              .filter(([, gap]) => (gap as number) > 0),
          ),
        }
      : null,
  };
}

export const CLASSIFICATION_LEVEL_LABELS: Record<ClassificationLevel, string> = {
  BELOW_JUNIOR: 'Below Junior',
  JUNIOR: 'Junior',
  JUNIOR_PLUS: 'Junior+',
  PLANNING_ENGINEER: 'Planning Engineer',
  PLANNING_ENGINEER_PLUS: 'Planning Engineer+',
  SENIOR_PLANNING_ENGINEER: 'Senior Planning Engineer',
  SENIOR_PLUS: 'Senior+',
  LEAD_PLANNING_ENGINEER: 'Lead Planning Engineer',
  PROJECT_CONTROLS_LEAD: 'Project Controls Lead',
  PLANNING_MANAGER: 'Planning Manager',
  PROJECT_CONTROLS_MANAGER: 'Project Controls Manager',
};

export { CLASSIFICATION_LEVELS };
