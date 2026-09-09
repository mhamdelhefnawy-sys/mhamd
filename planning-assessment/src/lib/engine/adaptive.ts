import { prisma } from '@/lib/db';
import type { CompetencyGroupCode } from '@/lib/constants';

export interface AbilityState {
  byCompetency: Partial<Record<CompetencyGroupCode, number>>; // running difficulty estimate, 1-5 (can be fractional)
  streak: Partial<Record<CompetencyGroupCode, number>>; // consecutive correct(+)/incorrect(-) per competency
}

export function initAbilityState(startDifficulty = 3): AbilityState {
  return { byCompetency: {}, streak: {} };
}

/**
 * Adaptive difficulty update (§23). Moves the running per-competency
 * ability estimate up when the candidate answers well and quickly, down
 * (and flags a diagnostic dip) when they answer poorly — this is what lets
 * the engine "estimate competency rather than simply count correct
 * answers": two candidates who both score 70% overall can end up on very
 * different achieved-difficulty trajectories depending on *when* they
 * struggled.
 */
export function updateAbility(
  state: AbilityState,
  competency: CompetencyGroupCode,
  currentDifficulty: number,
  scorePct: number, // 0-100, from auto-score or rubric
  timeSpentSec: number,
  estimatedTimeSec: number,
): AbilityState {
  const streak = state.streak[competency] ?? 0;
  const timeRatio = estimatedTimeSec > 0 ? timeSpentSec / estimatedTimeSec : 1;

  let delta = 0;
  if (scorePct >= 85) delta = timeRatio <= 1.2 ? 0.75 : 0.5;
  else if (scorePct >= 65) delta = 0.25;
  else if (scorePct >= 40) delta = -0.25;
  else delta = -0.75; // triggers a diagnostic (easier) question next

  const newStreak = scorePct >= 65 ? Math.max(1, streak + 1) : Math.min(-1, streak - 1);
  // Small momentum bonus/penalty on a run of 3+ same-direction results.
  if (Math.abs(newStreak) >= 3) delta += Math.sign(newStreak) * 0.25;

  const next = Math.max(1, Math.min(5, currentDifficulty + delta));

  return {
    byCompetency: { ...state.byCompetency, [competency]: next },
    streak: { ...state.streak, [competency]: newStreak },
  };
}

export function nextDifficultyFor(state: AbilityState, competency: CompetencyGroupCode, fallback = 3): number {
  return Math.round(state.byCompetency[competency] ?? fallback);
}

/**
 * Selects the next question for an adaptive assessment: matches the
 * competency + target difficulty band (±1, widening if the pool is thin),
 * optionally the category pool / career-level focus, excludes anything
 * already asked in this assessment, and picks randomly among the matches
 * (anti-memorization — see §49).
 */
export async function pickNextQuestion(params: {
  competency: CompetencyGroupCode;
  targetDifficulty: number;
  categoryCodes?: string[];
  careerLevels?: string[];
  excludeQuestionIds: string[];
}) {
  const { competency, targetDifficulty, categoryCodes, careerLevels, excludeQuestionIds } = params;

  const competencyRow = await prisma.competency.findUnique({ where: { code: competency } });
  if (!competencyRow) return null;

  const categoryRows = categoryCodes?.length
    ? await prisma.category.findMany({ where: { code: { in: categoryCodes } } })
    : [];

  const bands = [1, 2, 3]; // try tight band first, then widen
  for (const band of bands) {
    const candidates = await prisma.question.findMany({
      where: {
        competencyId: competencyRow.id,
        isActive: true,
        status: 'PUBLISHED',
        difficulty: { gte: Math.max(1, targetDifficulty - band), lte: Math.min(5, targetDifficulty + band) },
        ...(categoryRows.length ? { categoryId: { in: categoryRows.map((c) => c.id) } } : {}),
        ...(careerLevels?.length ? { careerLevel: { in: careerLevels } } : {}),
        id: { notIn: excludeQuestionIds.length ? excludeQuestionIds : undefined },
      },
      include: { options: true },
      take: 60,
    });
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return null;
}
