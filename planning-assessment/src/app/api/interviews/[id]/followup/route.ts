import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const followUp = await prisma.interviewFollowUp.create({
      data: {
        interviewId: params.id,
        assessmentQuestionId: body.assessmentQuestionId ?? null,
        prompt: body.prompt,
        response: body.response ?? null,
        score: body.score != null ? Number(body.score) : null,
      },
    });
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
