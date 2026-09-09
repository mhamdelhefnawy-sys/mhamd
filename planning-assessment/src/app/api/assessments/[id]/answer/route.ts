import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { scoreAutoAnswer, heuristicConceptScore } from '@/lib/engine/scoring';
import { AUTO_SCORED_TYPES, type CompetencyGroupCode } from '@/lib/constants';
import { advanceAdaptiveAssessment } from '@/lib/engine/adaptiveRuntime';
import { computeAssessmentScores } from '@/lib/engine/results';
import { toJson, fromJson } from '@/lib/json';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { assessmentQuestionId, candidateAnswer, writtenAnswerText, timeSpentSec } = body;

    const assessment = await prisma.assessment.findUnique({ where: { id: params.id } });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role === 'CANDIDATE' && assessment.candidateId !== session.candidateId) {
      throw new AuthError('Forbidden.', 403);
    }

    const aq = await prisma.assessmentQuestion.findUnique({
      where: { id: assessmentQuestionId },
      include: { question: { include: { competency: true } } },
    });
    if (!aq || aq.assessmentId !== assessment.id) throw new AuthError('Invalid question reference.', 400);

    const q = aq.question;
    const isAuto = AUTO_SCORED_TYPES.includes(q.questionType as (typeof AUTO_SCORED_TYPES)[number]);

    let isCorrect: boolean | null = null;
    let autoScore: number | null = null;
    let finalScore = 0;
    let detectedConcepts: string[] | null = null;
    let missingConcepts: string[] | null = null;

    if (isAuto) {
      const result = scoreAutoAnswer({ questionType: q.questionType, correctAnswerRaw: q.correctAnswer, candidateAnswer });
      isCorrect = result?.isCorrect ?? false;
      autoScore = result?.autoScore ?? 0;
      finalScore = autoScore;
    } else {
      const heuristic = heuristicConceptScore(String(writtenAnswerText ?? ''), q);
      detectedConcepts = heuristic.detectedConcepts;
      missingConcepts = heuristic.missingConcepts;
      autoScore = heuristic.draftScore;
      finalScore = heuristic.draftScore;
    }

    await prisma.answer.create({
      data: {
        assessmentQuestionId: aq.id,
        candidateAnswer: toJson(candidateAnswer ?? null),
        writtenAnswerText: writtenAnswerText ?? null,
        isCorrect,
        autoScore,
        finalScore,
        detectedConcepts: toJson(detectedConcepts),
        missingConcepts: toJson(missingConcepts),
        timeSpentSec: timeSpentSec ?? null,
        answeredAt: new Date(),
      },
    });
    await prisma.assessmentQuestion.update({ where: { id: aq.id }, data: { status: 'ANSWERED' } });

    let done = false;
    if (assessment.isAdaptive) {
      const advance = await advanceAdaptiveAssessment({
        assessmentId: assessment.id,
        competency: q.competency.code as CompetencyGroupCode,
        difficulty: q.difficulty,
        scorePct: finalScore,
        timeSpentSec: timeSpentSec ?? q.estimatedTimeSec,
        estimatedTimeSec: q.estimatedTimeSec,
      });
      done = advance.done;
    } else {
      const remaining = await prisma.assessmentQuestion.count({ where: { assessmentId: assessment.id, status: { in: ['PENDING', 'PRESENTED'] } } });
      done = remaining === 0;
    }

    let results = null;
    if (done) {
      results = await computeAssessmentScores(assessment.id);
    }

    const trainingMode = fromJson<{ resolved?: { trainingMode?: boolean } }>(assessment.config, {}).resolved?.trainingMode ?? false;

    return NextResponse.json({
      recorded: true,
      done,
      results: done ? results : null,
      feedback: trainingMode
        ? {
            isCorrect,
            score: finalScore,
            explanation: q.explanation,
            reasoning: q.reasoning,
            commonMistakes: fromJson(q.commonMistakes, []),
            p6Checks: fromJson(q.p6Checks, []),
            detectedConcepts,
            missingConcepts,
          }
        : null,
    });
  } catch (err) {
    return apiError(err);
  }
}
