import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { createQuestion } from '@/lib/engine/questionPersist';
import { sanitizeQuestionForRole } from '@/lib/engine/sanitize';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const sp = req.nextUrl.searchParams;
    const where: Record<string, unknown> = {};

    const category = sp.get('category');
    const competency = sp.get('competency');
    const difficulty = sp.get('difficulty');
    const careerLevel = sp.get('careerLevel');
    const questionType = sp.get('questionType');
    const status = sp.get('status');
    const q = sp.get('q');
    const page = Number(sp.get('page') ?? '1');
    const pageSize = Math.min(100, Number(sp.get('pageSize') ?? '25'));

    if (category) where.category = { code: category };
    if (competency) where.competency = { code: competency };
    if (difficulty) where.difficulty = Number(difficulty);
    if (careerLevel) where.careerLevel = careerLevel;
    if (questionType) where.questionType = questionType;
    if (status) where.status = status;
    if (q) where.OR = [{ question: { contains: q } }, { questionCode: { contains: q } }, { subcategory: { contains: q } }];

    // Candidates never get raw question-bank browsing access; role gate is also enforced by middleware for /question-bank UI routes.
    if (session.role === 'CANDIDATE') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        include: { category: true, competency: true, options: true, _count: { select: { assessmentQuestions: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      questions: questions.map((qq) => sanitizeQuestionForRole(qq, session.role, true)),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const body = await req.json();
    const question = await createQuestion(body, session.userId);
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
