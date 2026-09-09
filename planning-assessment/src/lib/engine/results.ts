import { prisma } from '@/lib/db';
import { defaultWeights, weightedOverallScore } from './competencies';
import { classifyCandidate, defaultThresholds, type ThresholdRow } from './classification';
import type { CompetencyGroupCode } from '@/lib/constants';
import { fromJson } from '@/lib/json';

interface AnswerRow {
  finalScore: number | null;
  autoScore: number | null;
  isCorrect: boolean | null;
  interviewerOverrideScore: number | null;
}

function effectiveScore(a: AnswerRow): number {
  if (a.interviewerOverrideScore != null) return a.interviewerOverrideScore;
  if (a.finalScore != null) return a.finalScore;
  if (a.autoScore != null) return a.autoScore;
  return a.isCorrect ? 100 : 0;
}

/**
 * Rolls every Answer in a completed assessment up into Score rows (§28
 * weighted competency scoring), classifies the candidate (§29), and
 * updates the Assessment summary fields. This is the single place that
 * turns raw answers into a competency profile — candidate pages, reports,
 * and analytics all read the Score rows this writes rather than
 * recomputing scoring logic themselves.
 */
export async function computeAssessmentScores(assessmentId: string) {
  const assessment = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  const aqs = await prisma.assessmentQuestion.findMany({
    where: { assessmentId },
    include: { question: { include: { competency: true, category: true } }, answer: true },
  });

  await prisma.score.deleteMany({ where: { assessmentId } });

  const byCompetency = new Map<string, { sum: number; count: number; correct: number; weight: number }>();
  const byDifficulty = new Map<number, { sum: number; count: number; correct: number }>();
  const byCategory = new Map<string, { sum: number; count: number; correct: number }>();

  for (const aq of aqs) {
    if (!aq.answer || aq.answer.answeredAt == null) continue;
    const score = effectiveScore(aq.answer);
    const isCorrect = aq.answer.isCorrect ?? score >= 60;

    const comp = aq.question.competency;
    const compAgg = byCompetency.get(comp.code) ?? { sum: 0, count: 0, correct: 0, weight: comp.defaultWeight };
    compAgg.sum += score;
    compAgg.count += 1;
    if (isCorrect) compAgg.correct += 1;
    byCompetency.set(comp.code, compAgg);

    const diffAgg = byDifficulty.get(aq.question.difficulty) ?? { sum: 0, count: 0, correct: 0 };
    diffAgg.sum += score;
    diffAgg.count += 1;
    if (isCorrect) diffAgg.correct += 1;
    byDifficulty.set(aq.question.difficulty, diffAgg);

    const catAgg = byCategory.get(aq.question.category.code) ?? { sum: 0, count: 0, correct: 0 };
    catAgg.sum += score;
    catAgg.count += 1;
    if (isCorrect) catAgg.correct += 1;
    byCategory.set(aq.question.category.code, catAgg);
  }

  const competencyRows = await prisma.competency.findMany();
  const competencyScorePct: Partial<Record<CompetencyGroupCode, number>> = {};
  for (const [code, agg] of byCompetency.entries()) {
    competencyScorePct[code as CompetencyGroupCode] = agg.count ? agg.sum / agg.count : 0;
  }

  // Weights come straight from the Competency table (admin-editable via /competencies), not a
  // separate settings blob — one source of truth for "what does each competency count for".
  const weights = competencyRows.length
    ? (Object.fromEntries(competencyRows.map((c) => [c.code, c.defaultWeight])) as ReturnType<typeof defaultWeights>)
    : defaultWeights();
  const overallScore = weightedOverallScore(competencyScorePct, weights);

  const totalAnswered = aqs.filter((a) => a.answer?.answeredAt).length;

  const thresholdRows = await prisma.levelThreshold.findMany({ orderBy: { order: 'asc' } });
  const thresholds: ThresholdRow[] = thresholdRows.length
    ? thresholdRows.map((t) => ({
        level: t.level as ThresholdRow['level'],
        order: t.order,
        minOverallScore: t.minOverallScore,
        minCriticalCompetencyScore: fromJson(t.minCriticalCompetencyScore, {}),
      }))
    : defaultThresholds();

  const classification = classifyCandidate({
    overallScore,
    competencyScores: competencyScorePct,
    questionsAnswered: totalAnswered,
    thresholds,
  });

  await prisma.$transaction([
    prisma.score.create({
      data: { assessmentId, scope: 'OVERALL', rawScore: overallScore, weightedScore: overallScore, questionsAnswered: totalAnswered, levelAchieved: classification.level },
    }),
    ...competencyRows
      .filter((c) => byCompetency.has(c.code))
      .map((c) => {
        const agg = byCompetency.get(c.code)!;
        return prisma.score.create({
          data: {
            assessmentId,
            competencyId: c.id,
            scope: 'COMPETENCY',
            scopeKey: c.code,
            rawScore: agg.count ? agg.sum / agg.count : 0,
            weightedScore: (weights[c.code as CompetencyGroupCode] ?? 0),
            questionsAnswered: agg.count,
            questionsCorrect: agg.correct,
          },
        });
      }),
    ...[...byDifficulty.entries()].map(([level, agg]) =>
      prisma.score.create({
        data: {
          assessmentId,
          scope: 'DIFFICULTY',
          scopeKey: String(level),
          rawScore: agg.count ? agg.sum / agg.count : 0,
          questionsAnswered: agg.count,
          questionsCorrect: agg.correct,
        },
      }),
    ),
    ...[...byCategory.entries()].map(([code, agg]) =>
      prisma.score.create({
        data: {
          assessmentId,
          scope: 'CATEGORY',
          scopeKey: code,
          rawScore: agg.count ? agg.sum / agg.count : 0,
          questionsAnswered: agg.count,
          questionsCorrect: agg.correct,
        },
      }),
    ),
    prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        overallScore,
        recommendedLevel: classification.level,
        confidenceLevel: classification.confidence,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    }),
  ]);

  return { overallScore, classification, competencyScorePct };
}
