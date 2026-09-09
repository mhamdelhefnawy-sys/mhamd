import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const q = req.nextUrl.searchParams.get('q');

    if (session.role === 'CANDIDATE') {
      const own = await prisma.candidate.findMany({ where: { id: session.candidateId } });
      return NextResponse.json({ candidates: own });
    }

    const candidates = await prisma.candidate.findMany({
      where: q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assessments: true } } },
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const body = await req.json();
    const candidate = await prisma.candidate.create({
      data: {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        currentPosition: body.currentPosition,
        targetPosition: body.targetPosition,
        yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : null,
        primaryProjectType: body.primaryProjectType,
        organization: body.organization,
        notes: body.notes,
      },
    });
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
