import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const report = await prisma.report.findUnique({ where: { id: params.id }, include: { candidate: true } });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role === 'CANDIDATE' && report.candidateId !== session.candidateId) throw new AuthError('Forbidden.', 403);
    return NextResponse.json({ report });
  } catch (err) {
    return apiError(err);
  }
}
