import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';

/** Bulk status/active changes (§33 bulk editing) and duplicate. */
export async function POST(req: NextRequest) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const body = await req.json();
    const { ids, action, status } = body as { ids: string[]; action: 'activate' | 'deactivate' | 'archive' | 'delete' | 'duplicate' | 'setStatus'; status?: string };

    if (action === 'delete') {
      await prisma.question.deleteMany({ where: { id: { in: ids } } });
    } else if (action === 'activate') {
      await prisma.question.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
    } else if (action === 'deactivate') {
      await prisma.question.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
    } else if (action === 'archive') {
      await prisma.question.updateMany({ where: { id: { in: ids } }, data: { status: 'ARCHIVED', isActive: false } });
    } else if (action === 'setStatus' && status) {
      await prisma.question.updateMany({ where: { id: { in: ids } }, data: { status } });
    } else if (action === 'duplicate') {
      const originals = await prisma.question.findMany({ where: { id: { in: ids } }, include: { options: true, tagLinks: true } });
      for (const o of originals) {
        const { id, createdAt, updatedAt, options, tagLinks, ...rest } = o;
        await prisma.question.create({
          data: {
            ...rest,
            questionCode: `${o.questionCode}-COPY-${Date.now().toString(36).slice(-4)}`,
            status: 'DRAFT',
            version: 1,
            options: { create: options.map(({ id: _oid, questionId: _qid, ...opt }) => opt) },
            tagLinks: { create: tagLinks.map(({ tag }) => ({ tag })) },
          },
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
