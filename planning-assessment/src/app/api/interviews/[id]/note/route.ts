import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const note = await prisma.interviewNote.create({
      data: { interviewId: params.id, assessmentQuestionId: body.assessmentQuestionId ?? null, note: body.note },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
