import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { scoreRubric, type RubricDefinition } from '@/lib/engine/scoring';
import { toJson, fromJson } from '@/lib/json';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const { assessmentQuestionId, writtenAnswerText, rubricScores, overrideScore, isCorrect, notes } = body;

    const interview = await prisma.interview.findUnique({ where: { id: params.id } });
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const aq = await prisma.assessmentQuestion.findUnique({
      where: { id: assessmentQuestionId },
      include: { question: true, answer: true },
    });
    if (!aq || aq.assessmentId !== interview.assessmentId) return NextResponse.json({ error: 'Invalid question' }, { status: 400 });

    let finalScore = overrideScore != null ? Number(overrideScore) : null;
    if (finalScore == null && rubricScores) {
      const rubric = fromJson<RubricDefinition | null>(aq.question.scoringRubric, null);
      finalScore = scoreRubric(rubricScores, rubric).finalScore;
    }
    if (finalScore == null) finalScore = isCorrect ? 100 : 0;

    const data = {
      writtenAnswerText: writtenAnswerText ?? aq.answer?.writtenAnswerText ?? null,
      rubricScores: rubricScores ? toJson(rubricScores) : aq.answer?.rubricScores ?? null,
      isCorrect: typeof isCorrect === 'boolean' ? isCorrect : aq.answer?.isCorrect ?? null,
      finalScore,
      interviewerOverrideScore: overrideScore != null ? Number(overrideScore) : aq.answer?.interviewerOverrideScore ?? null,
      interviewerNotes: notes ?? aq.answer?.interviewerNotes ?? null,
      answeredAt: new Date(),
    };

    const answer = aq.answer
      ? await prisma.answer.update({ where: { assessmentQuestionId: aq.id }, data })
      : await prisma.answer.create({ data: { assessmentQuestionId: aq.id, ...data } });

    await prisma.assessmentQuestion.update({ where: { id: aq.id }, data: { status: 'ANSWERED' } });

    return NextResponse.json({ answer });
  } catch (err) {
    return apiError(err);
  }
}
