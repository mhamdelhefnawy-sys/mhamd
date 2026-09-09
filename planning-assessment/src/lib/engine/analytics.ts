import { prisma } from '@/lib/db';
import { COMPETENCY_GROUPS } from '@/lib/constants';

/**
 * §51 Analytics: candidate/question/competency/level performance, plus
 * item-level flags (too easy / too hard) so admins can spot questions that
 * need review. `mostReliable` here means "most frequently used" (sample
 * size), not a psychometric reliability coefficient — a true discrimination
 * index would need item-response data volumes this seed platform doesn't
 * assume it has yet.
 */
export async function computeAnalyticsOverview() {
  const [candidateCount, assessments, competencyScores, questions] = await Promise.all([
    prisma.candidate.count(),
    prisma.assessment.findMany({ where: { status: 'COMPLETED' }, select: { overallScore: true, recommendedLevel: true, mode: true } }),
    prisma.score.findMany({ where: { scope: 'COMPETENCY' }, include: { competency: true } }),
    prisma.question.findMany({ include: { category: true, assessmentQuestions: { include: { answer: true } } } }),
  ]);

  const avgScore = assessments.length ? assessments.reduce((s, a) => s + (a.overallScore ?? 0), 0) / assessments.length : 0;
  const passRate = assessments.length ? (assessments.filter((a) => (a.overallScore ?? 0) >= 55).length / assessments.length) * 100 : 0;

  const levelCounts: Record<string, number> = {};
  for (const a of assessments) if (a.recommendedLevel) levelCounts[a.recommendedLevel] = (levelCounts[a.recommendedLevel] ?? 0) + 1;

  const competencyAvg = COMPETENCY_GROUPS.map((g) => {
    const rows = competencyScores.filter((s) => s.competency?.code === g.code);
    const avg = rows.length ? rows.reduce((s, r) => s + r.rawScore, 0) / rows.length : 0;
    return { code: g.code, name: g.name, avg: Math.round(avg), n: rows.length };
  });

  const itemStats = questions
    .map((q) => {
      const answered = q.assessmentQuestions.filter((aq) => aq.answer?.answeredAt);
      const n = answered.length;
      if (n === 0) return null;
      const scores = answered.map((aq) => aq.answer!.interviewerOverrideScore ?? aq.answer!.finalScore ?? aq.answer!.autoScore ?? 0);
      const avgPct = scores.reduce((s, v) => s + v, 0) / n;
      const correctCount = answered.filter((aq) => aq.answer!.isCorrect === true || (aq.answer!.finalScore ?? 0) >= 70).length;
      const correctRate = (correctCount / n) * 100;
      return {
        id: q.id,
        questionCode: q.questionCode,
        category: q.category.name,
        difficulty: q.difficulty,
        n,
        avgPct: Math.round(avgPct),
        correctRate: Math.round(correctRate),
        tooEasy: n >= 5 && correctRate >= 92,
        tooHard: n >= 5 && correctRate <= 15,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const mostMissed = [...itemStats].sort((a, b) => a.avgPct - b.avgPct).slice(0, 15);
  const mostReliable = [...itemStats].sort((a, b) => b.n - a.n).slice(0, 15);
  const flaggedTooEasy = itemStats.filter((i) => i.tooEasy);
  const flaggedTooHard = itemStats.filter((i) => i.tooHard);

  const strongest = [...competencyAvg].filter((c) => c.n > 0).sort((a, b) => b.avg - a.avg).slice(0, 3);
  const weakest = [...competencyAvg].filter((c) => c.n > 0).sort((a, b) => a.avg - b.avg).slice(0, 3);

  return {
    candidateCount,
    assessmentCount: assessments.length,
    avgScore: Math.round(avgScore * 10) / 10,
    passRate: Math.round(passRate),
    levelCounts,
    competencyAvg,
    strongest,
    weakest,
    mostMissed,
    mostReliable,
    flaggedTooEasy,
    flaggedTooHard,
    totalQuestionsWithData: itemStats.length,
  };
}
