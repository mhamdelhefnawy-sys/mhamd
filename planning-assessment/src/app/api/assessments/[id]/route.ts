import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const assessment = await prisma.assessment.findUnique({
      where: { id: params.id },
      include: {
        candidate: true,
        scores: { include: { competency: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { category: true, competency: true } }, answer: true },
        },
      },
    });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role === 'CANDIDATE' && assessment.candidateId !== session.candidateId) {
      throw new AuthError('Forbidden.', 403);
    }
    return NextResponse.json({ assessment });
  } catch (err) {
    return apiError(err);
  }
}
