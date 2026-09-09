import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { fromJson } from '@/lib/json';
import type { ReportSummary } from '@/lib/engine/report';
import { ReportDocument } from '@/lib/pdf/ReportDocument';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session.role === 'CANDIDATE' && report.candidateId !== session.candidateId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const summary = fromJson<ReportSummary | null>(report.summary, null);
  if (!summary) return NextResponse.json({ error: 'Report summary is missing.' }, { status: 500 });

  const buffer = await renderToBuffer(createElement(ReportDocument, { summary }) as Parameters<typeof renderToBuffer>[0]);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="assessment-report-${summary.candidate.fullName.replace(/\s+/g, '-')}.pdf"`,
    },
  });
}
