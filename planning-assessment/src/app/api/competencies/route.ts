import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';

export async function GET() {
  try {
    await requireSession();
    const competencies = await prisma.competency.findMany({ orderBy: { defaultWeight: 'desc' }, include: { _count: { select: { questions: true } } } });
    return NextResponse.json({ competencies });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession(['ADMIN']);
    const body = await req.json();
    const updates: { code: string; defaultWeight: number; isCritical: boolean }[] = body.competencies;

    const sum = updates.reduce((s, u) => s + Number(u.defaultWeight), 0);
    if (Math.abs(sum - 100) > 0.5) {
      throw new AuthError(`Weights must sum to 100 (got ${sum.toFixed(1)}).`, 400);
    }

    await prisma.$transaction(
      updates.map((u) => prisma.competency.update({ where: { code: u.code }, data: { defaultWeight: Number(u.defaultWeight), isCritical: !!u.isCritical } })),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
