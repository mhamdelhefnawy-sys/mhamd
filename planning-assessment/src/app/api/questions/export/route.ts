import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { fromJson } from '@/lib/json';

export async function GET(req: NextRequest) {
  try {
    await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const format = req.nextUrl.searchParams.get('format') ?? 'json';
    const category = req.nextUrl.searchParams.get('category');

    const questions = await prisma.question.findMany({
      where: category ? { category: { code: category } } : undefined,
      include: { category: true, competency: true, options: true },
      orderBy: { questionCode: 'asc' },
    });

    const normalized = questions.map((q) => ({
      questionCode: q.questionCode,
      category: q.category.code,
      subcategory: q.subcategory,
      competency: q.competency.code,
      skill: q.skill,
      difficulty: q.difficulty,
      careerLevel: q.careerLevel,
      questionType: q.questionType,
      scenario: q.scenario,
      question: q.question,
      options: q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
      correctAnswer: fromJson(q.correctAnswer, null),
      expectedAnswer: q.expectedAnswer,
      strongAnswer: q.strongAnswer,
      expertAnswer: q.expertAnswer,
      explanation: q.explanation,
      reasoning: q.reasoning,
      commonMistakes: fromJson(q.commonMistakes, []),
      redFlags: fromJson(q.redFlags, []),
      p6Checks: fromJson(q.p6Checks, []),
      followUpQuestions: fromJson(q.followUpQuestions, []),
      scoringRubric: fromJson(q.scoringRubric, null),
      weight: q.weight,
      estimatedTimeSec: q.estimatedTimeSec,
      tags: fromJson(q.tags, []),
      references: fromJson(q.references, []),
      status: q.status,
    }));

    if (format === 'csv') {
      const csv = Papa.unparse(
        normalized.map((n) => ({
          questionCode: n.questionCode,
          category: n.category,
          subcategory: n.subcategory,
          competency: n.competency,
          skill: n.skill,
          difficulty: n.difficulty,
          careerLevel: n.careerLevel,
          questionType: n.questionType,
          scenario: n.scenario,
          question: n.question,
          optionsJson: JSON.stringify(n.options),
          correctAnswerJson: JSON.stringify(n.correctAnswer),
          expectedAnswer: n.expectedAnswer,
          explanation: n.explanation,
          reasoning: n.reasoning,
          scoringRubricJson: n.scoringRubric ? JSON.stringify(n.scoringRubric) : '',
          tags: (n.tags as string[]).join(','),
          weight: n.weight,
          estimatedTimeSec: n.estimatedTimeSec,
          status: n.status,
        })),
      );
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="question-bank-export.csv"' },
      });
    }

    return new NextResponse(JSON.stringify(normalized, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="question-bank-export.json"' },
    });
  } catch (err) {
    return apiError(err);
  }
}
