import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { updateQuestion } from '@/lib/engine/questionPersist';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { category: true, competency: true, options: true, versions: { orderBy: { versionNumber: 'desc' } }, flagRecords: { orderBy: { createdAt: 'desc' } } },
    });
    if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ question });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const body = await req.json();
    if (body.statusOnly) {
      const question = await prisma.question.update({ where: { id: params.id }, data: { status: body.status, isActive: body.isActive } });
      return NextResponse.json({ question });
    }
    const question = await updateQuestion(params.id, body, session.userId, body.changeNote);
    return NextResponse.json({ question });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession(['ADMIN']);
    await prisma.question.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
