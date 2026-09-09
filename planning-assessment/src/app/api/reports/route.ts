import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { buildReportSummary } from '@/lib/engine/report';
import { toJson } from '@/lib/json';

export async function GET() {
  try {
    const session = await requireSession();
    const where = session.role === 'CANDIDATE' ? { candidateId: session.candidateId } : {};
    const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, include: { candidate: true } });
    return NextResponse.json({ reports });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER']);
    const { assessmentId } = await req.json();
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new AuthError('Assessment not found.', 404);
    if (assessment.status !== 'COMPLETED') throw new AuthError('Assessment is not completed yet.', 400);

    const summary = await buildReportSummary(assessmentId);
    const report = await prisma.report.create({
      data: {
        assessmentId,
        candidateId: assessment.candidateId,
        generatedById: session.userId,
        type: 'ASSESSMENT_REPORT',
        recommendation: summary.recommendation,
        summary: toJson(summary) ?? '{}',
      },
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
