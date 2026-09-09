import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError, AuthError } from '@/lib/auth/guards';
import { parseXerTables, toParsedSchedule } from '@/lib/xer/parseXer';
import { runScheduleDiagnostics } from '@/lib/xer/diagnostics';
import { toJson, fromJson } from '@/lib/json';

export async function GET() {
  try {
    await requireSession();
    const imports = await prisma.scheduleImport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return NextResponse.json({ imports: imports.map((i) => ({ ...i, summary: fromJson(i.summary, null) })) });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { fileName, content } = body as { fileName: string; content: string };
    if (!content || !content.includes('%T')) {
      throw new AuthError('This does not look like a valid .xer file (no %T table markers found).', 400);
    }

    const tables = parseXerTables(content);
    const schedule = toParsedSchedule(tables);
    const diagnostics = runScheduleDiagnostics(schedule);

    const record = await prisma.scheduleImport.create({
      data: {
        fileName: fileName ?? 'upload.xer',
        projectName: schedule.projectName,
        importedById: session.userId,
        status: 'PARSED',
        summary: toJson({ schedule: { ...schedule, activities: undefined }, diagnostics }),
      },
    });

    return NextResponse.json({ import: record, schedule: { ...schedule, activities: schedule.activities.slice(0, 500) }, diagnostics });
  } catch (err) {
    return apiError(err);
  }
}
