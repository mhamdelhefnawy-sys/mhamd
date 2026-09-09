import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { computeAssessmentScores } from '@/lib/engine/results';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const interview = await prisma.interview.findUnique({
      where: { id: params.id },
      include: {
        candidate: true,
        interviewer: true,
        notes: { orderBy: { createdAt: 'asc' } },
        followUps: { orderBy: { askedAt: 'asc' } },
        assessment: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { question: { include: { options: true, category: true, competency: true } }, answer: true },
            },
            scores: { include: { competency: true } },
          },
        },
      },
    });
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ interview });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const interview = await prisma.interview.findUnique({ where: { id: params.id } });
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.status === 'COMPLETED') {
      await prisma.assessmentQuestion.updateMany({
        where: { assessmentId: interview.assessmentId!, status: { in: ['PENDING', 'PRESENTED'] } },
        data: { status: 'SKIPPED' },
      });
      if (interview.assessmentId) await computeAssessmentScores(interview.assessmentId);
      await prisma.interview.update({ where: { id: params.id }, data: { status: 'COMPLETED', endedAt: new Date() } });
    } else {
      await prisma.interview.update({ where: { id: params.id }, data: { status: body.status } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
