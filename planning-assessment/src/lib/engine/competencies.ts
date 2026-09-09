import { COMPETENCY_GROUPS, type CompetencyGroupCode } from '@/lib/constants';

export type WeightMap = Record<CompetencyGroupCode, number>;

export function defaultWeights(): WeightMap {
  return Object.fromEntries(COMPETENCY_GROUPS.map((g) => [g.code, g.weight])) as WeightMap;
}

/** Admin-customizable weights (§28) must sum to 100; normalize defensively if they drift. */
export function normalizeWeights(weights: Partial<WeightMap>): WeightMap {
  const full = { ...defaultWeights(), ...weights } as WeightMap;
  const sum = Object.values(full).reduce((a, b) => a + b, 0);
  if (sum <= 0) return defaultWeights();
  if (Math.abs(sum - 100) < 0.01) return full;
  const scaled = {} as WeightMap;
  (Object.keys(full) as CompetencyGroupCode[]).forEach((k) => {
    scaled[k] = (full[k] / sum) * 100;
  });
  return scaled;
}

export function weightedOverallScore(competencyScores: Partial<Record<CompetencyGroupCode, number>>, weights: WeightMap): number {
  let total = 0;
  let weightSum = 0;
  (Object.keys(weights) as CompetencyGroupCode[]).forEach((code) => {
    const score = competencyScores[code];
    if (score == null) return; // competency not assessed in this run — excluded, not zeroed
    total += score * weights[code];
    weightSum += weights[code];
  });
  return weightSum > 0 ? total / weightSum : 0;
}

export const CRITICAL_COMPETENCY_CODES: CompetencyGroupCode[] = COMPETENCY_GROUPS.filter((g) => g.isCritical).map(
  (g) => g.code,
);
