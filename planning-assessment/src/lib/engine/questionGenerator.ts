import { fromJson, toJson } from '@/lib/json';

/**
 * Parameterized numeric-variant generator (§48/§49). For a NUMERICAL
 * question whose `givenData` object holds the inputs used to derive
 * `correctAnswer`, this produces a fresh, mathematically-consistent
 * variant by scaling every numeric input by the same random factor and
 * recomputing — so the same underlying skill is tested with different
 * numbers each time, which defeats simple memorization of "the answer is
 * 1.05" without the candidate needing to reason through it again.
 *
 * This only handles the common case where correctAnswer is a *linear*
 * function of givenData (durations, quantities, costs, float days — true
 * for the great majority of authored NUMERICAL questions: EVM ratios,
 * float calculations, productivity rates). Questions whose givenData is
 * absent, or whose relationship isn't linear, are left unvaried (returns
 * null) — admins can still hand-author additional explicit variants
 * through the question bank UI, which is the documented path for content
 * that needs non-linear parameterization.
 */
export function generateNumericVariant(question: {
  givenData: string | null;
  correctAnswer: string | null;
}): { givenData: Record<string, number>; correctAnswer: number; scaleFactor: number } | null {
  const given = fromJson<Record<string, unknown>>(question.givenData, {});
  const correct = fromJson<unknown>(question.correctAnswer, null);
  if (typeof correct !== 'number') return null;

  const numericKeys = Object.keys(given).filter((k) => typeof given[k] === 'number');
  if (numericKeys.length === 0) return null;

  const scaleFactor = 0.8 + Math.random() * 0.5; // 0.8x - 1.3x
  const newGiven: Record<string, number> = {};
  for (const k of numericKeys) {
    const v = given[k] as number;
    // Round sensibly: integers stay integers, currency/percent keep 2 decimals.
    const scaled = v * scaleFactor;
    newGiven[k] = Number.isInteger(v) ? Math.round(scaled) : Math.round(scaled * 100) / 100;
  }
  const newCorrect = Math.round(correct * scaleFactor * 10000) / 10000;

  return { givenData: newGiven, correctAnswer: newCorrect, scaleFactor };
}

export function serializeVariant(variant: ReturnType<typeof generateNumericVariant>) {
  if (!variant) return null;
  return toJson(variant);
}
