import { AUTO_SCORED_TYPES, RUBRIC_DIMENSIONS, type RubricDimension } from '@/lib/constants';
import { fromJson, fromJsonArray } from '@/lib/json';

export interface RubricDefinition {
  dimensions: { name: RubricDimension; maxScore: number; guidance?: string }[];
  passingScore: number;
}

export interface AutoScoreResult {
  isCorrect: boolean;
  autoScore: number; // 0-100
}

/**
 * Scores closed-form answers (MCQ / MULTI_SELECT / TRUE_FALSE / NUMERICAL)
 * against `correctAnswer`. MULTI_SELECT gives partial credit; NUMERICAL
 * allows a small tolerance band since real-world float/EVM figures are
 * often expressed to varying precision.
 */
export function scoreAutoAnswer(params: {
  questionType: string;
  correctAnswerRaw: string | null;
  candidateAnswer: unknown;
}): AutoScoreResult | null {
  const { questionType, correctAnswerRaw, candidateAnswer } = params;
  if (!AUTO_SCORED_TYPES.includes(questionType as (typeof AUTO_SCORED_TYPES)[number])) return null;
  if (correctAnswerRaw == null || candidateAnswer == null) return { isCorrect: false, autoScore: 0 };

  const correctAnswer = fromJson<unknown>(correctAnswerRaw, null);

  if (questionType === 'MCQ' || questionType === 'TRUE_FALSE') {
    const isCorrect = String(candidateAnswer).trim() === String(correctAnswer).trim();
    return { isCorrect, autoScore: isCorrect ? 100 : 0 };
  }

  if (questionType === 'MULTI_SELECT') {
    const correctSet = new Set((correctAnswer as string[]) ?? []);
    const givenSet = new Set(((candidateAnswer as string[]) ?? []).map(String));
    if (correctSet.size === 0) return { isCorrect: false, autoScore: 0 };
    let hits = 0;
    let wrong = 0;
    givenSet.forEach((v) => (correctSet.has(v) ? hits++ : wrong++));
    const raw = (hits - wrong) / correctSet.size;
    const autoScore = Math.max(0, Math.min(1, raw)) * 100;
    const isCorrect =
      correctSet.size === givenSet.size && [...correctSet].every((v) => givenSet.has(v));
    return { isCorrect, autoScore };
  }

  if (questionType === 'NUMERICAL') {
    const correctNum = Number(correctAnswer);
    const givenNum = Number(candidateAnswer);
    if (Number.isNaN(correctNum) || Number.isNaN(givenNum)) return { isCorrect: false, autoScore: 0 };
    const tolerance = Math.max(Math.abs(correctNum) * 0.02, 0.01); // 2% relative tolerance
    const isCorrect = Math.abs(correctNum - givenNum) <= tolerance;
    return { isCorrect, autoScore: isCorrect ? 100 : 0 };
  }

  return { isCorrect: false, autoScore: 0 };
}

/**
 * Rubric scoring for open-ended answers. `rubricScores` are 0-5 per
 * dimension, provided either by an interviewer/reviewer (authoritative) or
 * by the heuristic concept-detector below (draft, always labeled as such —
 * see docs/SCORING_METHODOLOGY.md for why this is not "AI grading").
 */
export function scoreRubric(
  rubricScores: Partial<Record<RubricDimension, number>>,
  rubric: RubricDefinition | null,
): { finalScore: number; passed: boolean } {
  const dims = rubric?.dimensions?.length ? rubric.dimensions : RUBRIC_DIMENSIONS.map((name) => ({ name, maxScore: 5 }));
  let earned = 0;
  let max = 0;
  for (const d of dims) {
    const v = rubricScores[d.name] ?? 0;
    earned += Math.max(0, Math.min(d.maxScore, v));
    max += d.maxScore;
  }
  const finalScore = max > 0 ? (earned / max) * 100 : 0;
  const passingScore = rubric?.passingScore ?? max * 0.6;
  const passed = earned >= passingScore;
  return { finalScore, passed };
}

const STOPWORDS = new Set(
  'a an the is are was were be been being to of in on at for with and or but if then than so that this these those it its as by from into onto not no does do did will would can could should shall may might must has have had you your candidate must explain what how why when where which who'.split(
    ' ',
  ),
);

function significantTerms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9%\-\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  );
}

/**
 * Heuristic keyword/concept-detection "draft score" for a written answer.
 * This is intentionally simple and is NEVER the final authoritative score —
 * it exists to (a) give a candidate immediate indicative feedback in
 * Training Mode and (b) pre-fill a starting point for an interviewer's
 * rubric, who always sees and can override every dimension. See
 * docs/SCORING_METHODOLOGY.md.
 */
export function heuristicConceptScore(
  writtenAnswerText: string,
  question: { expectedAnswer?: string | null; strongAnswer?: string | null; tags?: string | null },
): { detectedConcepts: string[]; missingConcepts: string[]; draftScore: number } {
  const conceptSource = [question.expectedAnswer, question.strongAnswer].filter(Boolean).join(' ');
  const tagTerms = fromJsonArray<string>(question.tags).map((t) => t.toLowerCase());
  const concepts = Array.from(new Set([...significantTerms(conceptSource), ...tagTerms])).slice(0, 25);
  const answerLower = writtenAnswerText.toLowerCase();

  const detected: string[] = [];
  const missing: string[] = [];
  for (const c of concepts) {
    if (answerLower.includes(c)) detected.push(c);
    else missing.push(c);
  }
  const draftScore = concepts.length > 0 ? (detected.length / concepts.length) * 100 : 0;
  return { detectedConcepts: detected, missingConcepts: missing, draftScore };
}
