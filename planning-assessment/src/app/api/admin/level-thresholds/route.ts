import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { toJson } from '@/lib/json';

export async function GET() {
  try {
    await requireSession();
    const thresholds = await prisma.levelThreshold.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json({ thresholds });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession(['ADMIN']);
    const body = await req.json();
    const updates: { level: string; minOverallScore: number; minCriticalCompetencyScore: Record<string, number> }[] = body.thresholds;

    await prisma.$transaction(
      updates.map((u) =>
        prisma.levelThreshold.update({
          where: { level: u.level },
          data: { minOverallScore: Number(u.minOverallScore), minCriticalCompetencyScore: toJson(u.minCriticalCompetencyScore) ?? '{}' },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
