import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { createAssessment } from '@/lib/engine/assessmentBuilder';
import { ASSESSMENT_MODES, type AssessmentMode } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const status = req.nextUrl.searchParams.get('status');
    const where: Record<string, unknown> = {};
    if (session.role === 'CANDIDATE') {
      if (!session.candidateId) return NextResponse.json({ assessments: [] });
      where.candidateId = session.candidateId;
    }
    if (status) where.status = status;

    const assessments = await prisma.assessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { candidate: true, _count: { select: { questions: true } } },
      take: 200,
    });
    return NextResponse.json({ assessments });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();

    let candidateId: string = body.candidateId;
    if (session.role === 'CANDIDATE') {
      if (!session.candidateId) throw new AuthError('No candidate profile linked to this account.', 400);
      candidateId = session.candidateId;
    } else if (!candidateId) {
      throw new AuthError('candidateId is required.', 400);
    }

    const mode = body.mode as AssessmentMode;
    if (!ASSESSMENT_MODES.includes(mode)) throw new AuthError('Invalid assessment mode.', 400);

    const assessment = await createAssessment({
      candidateId,
      mode,
      createdById: session.userId,
      targetPosition: body.targetPosition,
      projectTypeContext: body.projectTypeContext,
      config: {
        competencyCodes: body.competencyCodes,
        categoryCodes: body.categoryCodes,
        careerLevels: body.careerLevels,
        questionCount: body.questionCount ? Number(body.questionCount) : undefined,
        timeLimitSec: body.timeLimitSec ? Number(body.timeLimitSec) : undefined,
        randomizeOrder: body.randomizeOrder,
        isAdaptive: body.isAdaptive,
      },
    });

    await prisma.assessment.update({ where: { id: assessment.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
