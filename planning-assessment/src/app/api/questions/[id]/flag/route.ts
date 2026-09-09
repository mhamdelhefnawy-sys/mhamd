import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const record = await prisma.questionFlagRecord.create({
      data: { questionId: params.id, flag: body.flag, note: body.note, raisedById: session.userId },
    });
    await prisma.question.update({ where: { id: params.id }, data: { status: 'REVIEW' } });
    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const body = await req.json();
    const record = await prisma.questionFlagRecord.update({
      where: { id: body.flagRecordId },
      data: { resolved: true, resolutionNote: body.resolutionNote },
    });
    return NextResponse.json({ record });
  } catch (err) {
    return apiError(err);
  }
}
