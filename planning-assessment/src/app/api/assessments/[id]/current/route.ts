import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { sanitizeQuestionForRole } from '@/lib/engine/sanitize';
import { fromJson, fromJsonArray } from '@/lib/json';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const assessment = await prisma.assessment.findUnique({ where: { id: params.id } });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role === 'CANDIDATE' && assessment.candidateId !== session.candidateId) {
      throw new AuthError('Forbidden.', 403);
    }

    const total = await prisma.assessmentQuestion.count({ where: { assessmentId: assessment.id } });
    const answered = await prisma.assessmentQuestion.count({ where: { assessmentId: assessment.id, status: 'ANSWERED' } });

    const next = await prisma.assessmentQuestion.findFirst({
      where: { assessmentId: assessment.id, status: { in: ['PENDING', 'PRESENTED'] } },
      orderBy: { order: 'asc' },
      include: { question: { include: { options: true, category: true, competency: true } } },
    });

    if (!next) {
      return NextResponse.json({ assessment, done: true, progress: { answered, total } });
    }

    if (next.status === 'PENDING') {
      await prisma.assessmentQuestion.update({ where: { id: next.id }, data: { status: 'PRESENTED', presentedAt: new Date() } });
    }

    const optionOrder = fromJsonArray<string>(next.presentedOptionsOrder);
    const optionsById = new Map(next.question.options.map((o) => [o.id, o]));
    const orderedOptions = optionOrder.length ? optionOrder.map((id) => optionsById.get(id)).filter(Boolean) : next.question.options;

    const questionPayload = {
      ...next.question,
      options: orderedOptions,
    };

    const trainingMode = fromJson<{ resolved?: { trainingMode?: boolean } }>(assessment.config, {}).resolved?.trainingMode ?? false;

    return NextResponse.json({
      assessment,
      done: false,
      progress: { answered, total },
      assessmentQuestionId: next.id,
      timeAllowedSec: next.question.estimatedTimeSec,
      trainingMode,
      question: sanitizeQuestionForRole(questionPayload, session.role),
    });
  } catch (err) {
    return apiError(err);
  }
}
