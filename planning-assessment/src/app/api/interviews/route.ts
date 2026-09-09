import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { createAssessment } from '@/lib/engine/assessmentBuilder';
import { toJson } from '@/lib/json';

export async function GET() {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const interviews = await prisma.interview.findMany({
      orderBy: { createdAt: 'desc' },
      include: { candidate: true, interviewer: true, assessment: { select: { id: true, status: true, overallScore: true } } },
    });
    return NextResponse.json({ interviews });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();

    const assessment = await createAssessment({
      candidateId: body.candidateId,
      mode: 'INTERVIEW',
      createdById: session.userId,
      targetPosition: body.position,
      projectTypeContext: body.projectType,
      config: {
        competencyCodes: body.competenciesFocus?.length ? body.competenciesFocus : undefined,
        careerLevels: body.experienceLevel ? [body.experienceLevel] : undefined,
        questionCount: body.questionCount ? Number(body.questionCount) : undefined,
        isAdaptive: false,
        randomizeOrder: false,
      },
    });
    await prisma.assessment.update({ where: { id: assessment.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });

    const interview = await prisma.interview.create({
      data: {
        assessmentId: assessment.id,
        candidateId: body.candidateId,
        interviewerId: body.interviewerId || session.userId,
        position: body.position,
        projectType: body.projectType,
        experienceLevel: body.experienceLevel,
        plannedDurationMin: body.plannedDurationMin ? Number(body.plannedDurationMin) : null,
        competenciesFocus: toJson(body.competenciesFocus ?? []),
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ interview }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
