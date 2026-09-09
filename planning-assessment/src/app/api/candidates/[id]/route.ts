import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { COMPETENCY_GROUPS } from '@/lib/constants';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (session.role === 'CANDIDATE' && session.candidateId !== params.id) {
      throw new AuthError('Forbidden.', 403);
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: { scores: { include: { competency: true } } },
        },
        reports: { orderBy: { createdAt: 'desc' } },
        interviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Aggregate a competency profile across ALL completed assessments (most recent per competency wins the "current" read, but we also show the trend).
    const completed = candidate.assessments.filter((a) => a.status === 'COMPLETED');
    const latest = completed[0];
    const competencyProfile = COMPETENCY_GROUPS.map((g) => {
      const row = latest?.scores.find((s) => s.scope === 'COMPETENCY' && s.competency?.code === g.code);
      return { code: g.code, name: g.name, score: row ? Math.round(row.rawScore) : null, weight: g.weight, isCritical: g.isCritical };
    });

    return NextResponse.json({ candidate, latestAssessment: latest ?? null, competencyProfile });
  } catch (err) {
    return apiError(err);
  }
}
