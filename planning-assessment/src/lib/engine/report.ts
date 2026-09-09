import { prisma } from '@/lib/db';
import { COMPETENCY_GROUPS, type CompetencyGroupCode, type Recommendation } from '@/lib/constants';
import { CLASSIFICATION_LEVEL_LABELS, type ClassificationLevel } from './classification';
import { fromJsonArray } from '@/lib/json';

export interface ReportSummary {
  candidate: { id: string; fullName: string; email: string; currentPosition: string | null; targetPosition: string | null };
  assessment: { id: string; code: string; mode: string; startedAt: string | null; completedAt: string | null; durationMin: number | null };
  overallScore: number;
  recommendedLevel: ClassificationLevel;
  recommendedLevelLabel: string;
  confidenceLevel: string;
  competencyMatrix: Array<{ code: CompetencyGroupCode; name: string; weight: number; score: number; isCritical: boolean; questionsAnswered: number }>;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  developmentAreas: string[];
  recommendation: Recommendation;
  interviewerNotes: string[];
}

function recommendationFor(overallScore: number, hasCriticalGap: boolean): Recommendation {
  if (overallScore >= 85 && !hasCriticalGap) return 'STRONGLY_RECOMMENDED';
  if (overallScore >= 70 && !hasCriticalGap) return 'RECOMMENDED';
  if (overallScore >= 55) return 'RECOMMENDED_WITH_DEVELOPMENT';
  if (overallScore >= 40) return 'BORDERLINE';
  return 'NOT_RECOMMENDED';
}

export async function buildReportSummary(assessmentId: string): Promise<ReportSummary> {
  const assessment = await prisma.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      candidate: true,
      scores: { include: { competency: true } },
      interview: { include: { notes: true } },
      questions: { include: { question: true, answer: true } },
    },
  });

  const competencyMatrix = COMPETENCY_GROUPS.map((g) => {
    const row = assessment.scores.find((s) => s.scope === 'COMPETENCY' && s.competency?.code === g.code);
    return {
      code: g.code,
      name: g.name,
      weight: g.weight,
      score: row ? Math.round(row.rawScore) : 0,
      isCritical: g.isCritical,
      questionsAnswered: row?.questionsAnswered ?? 0,
    };
  }).filter((c) => c.questionsAnswered > 0);

  const sorted = [...competencyMatrix].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 3).filter((c) => c.score >= 60).map((c) => `${c.name} (${c.score}%)`);
  const weaknesses = sorted
    .slice(-3)
    .reverse()
    .filter((c) => c.score < 65)
    .map((c) => `${c.name} (${c.score}%)`);

  const criticalGaps = competencyMatrix.filter((c) => c.isCritical && c.score < 55);
  const redFlags: string[] = criticalGaps.map((c) => `Critical competency below threshold: ${c.name} (${c.score}%).`);

  // Pull authored red flags from low-scoring answers as additional evidence.
  for (const aq of assessment.questions) {
    if (!aq.answer) continue;
    const score = aq.answer.interviewerOverrideScore ?? aq.answer.finalScore ?? aq.answer.autoScore ?? 100;
    if (score < 40) {
      const flags = fromJsonArray<string>(aq.question.redFlags);
      if (flags.length) redFlags.push(...flags.slice(0, 1));
    }
  }

  const developmentAreas = weaknesses.length ? weaknesses : ['No significant development areas identified at this assessment depth.'];

  const durationMin =
    assessment.startedAt && assessment.completedAt
      ? Math.round((new Date(assessment.completedAt).getTime() - new Date(assessment.startedAt).getTime()) / 60000)
      : null;

  return {
    candidate: {
      id: assessment.candidate.id,
      fullName: assessment.candidate.fullName,
      email: assessment.candidate.email,
      currentPosition: assessment.candidate.currentPosition,
      targetPosition: assessment.candidate.targetPosition,
    },
    assessment: {
      id: assessment.id,
      code: assessment.code,
      mode: assessment.mode,
      startedAt: assessment.startedAt?.toISOString() ?? null,
      completedAt: assessment.completedAt?.toISOString() ?? null,
      durationMin,
    },
    overallScore: Math.round((assessment.overallScore ?? 0) * 10) / 10,
    recommendedLevel: (assessment.recommendedLevel ?? 'BELOW_JUNIOR') as ClassificationLevel,
    recommendedLevelLabel: CLASSIFICATION_LEVEL_LABELS[(assessment.recommendedLevel ?? 'BELOW_JUNIOR') as ClassificationLevel],
    confidenceLevel: assessment.confidenceLevel ?? 'LOW',
    competencyMatrix,
    strengths: strengths.length ? strengths : ['Not enough data to confirm standout strengths yet.'],
    weaknesses,
    redFlags: [...new Set(redFlags)].slice(0, 8),
    developmentAreas,
    recommendation: recommendationFor(assessment.overallScore ?? 0, criticalGaps.length > 0),
    interviewerNotes: assessment.interview?.notes.map((n) => n.note) ?? [],
  };
}
