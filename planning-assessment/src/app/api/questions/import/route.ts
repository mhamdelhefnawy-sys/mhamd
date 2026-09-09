import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { questionArraySchema, type QuestionInput } from '@/lib/validation/questionSchema';
import { createQuestion, updateQuestion, type QuestionFormInput } from '@/lib/engine/questionPersist';

function toFormInput(q: QuestionInput): QuestionFormInput {
  return {
    questionCode: q.questionCode,
    categoryCode: q.category,
    subcategory: q.subcategory,
    competencyCode: q.competency,
    skill: q.skill,
    difficulty: q.difficulty,
    careerLevel: q.careerLevel,
    secondaryCareerLevels: q.secondaryCareerLevels,
    questionType: q.questionType,
    scenario: q.scenario,
    question: q.question,
    questionAr: q.questionAr,
    options: q.options?.map((o) => ({ label: o.label, text: o.text, textAr: o.textAr, isCorrect: !!o.isCorrect })),
    correctAnswer: q.correctAnswer,
    expectedAnswer: q.expectedAnswer,
    strongAnswer: q.strongAnswer,
    expertAnswer: q.expertAnswer,
    explanation: q.explanation,
    reasoning: q.reasoning,
    commonMistakes: q.commonMistakes,
    redFlags: q.redFlags,
    p6Checks: q.p6Checks,
    followUpQuestions: q.followUpQuestions,
    scoringRubric: q.scoringRubric,
    weight: q.weight,
    estimatedTimeSec: q.estimatedTimeSec,
    tags: q.tags,
    references: q.references,
    projectType: q.projectType,
    projectSituation: q.projectSituation,
    givenData: q.givenData as Record<string, unknown> | undefined,
    requiredAnalysis: q.requiredAnalysis,
    expectedDecision: q.expectedDecision,
    acceptableAlternativeAnswers: q.acceptableAlternativeAnswers,
    status: 'PUBLISHED',
  };
}

function csvRowToQuestion(row: Record<string, string>): unknown {
  const parseJsonCell = (v: string | undefined) => {
    if (!v) return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  return {
    questionCode: row.questionCode,
    category: row.category,
    subcategory: row.subcategory || 'General',
    competency: row.competency,
    skill: row.skill || row.subcategory || 'General',
    difficulty: Number(row.difficulty || 3),
    careerLevel: row.careerLevel,
    questionType: row.questionType,
    scenario: row.scenario || undefined,
    question: row.question,
    options: parseJsonCell(row.optionsJson),
    correctAnswer: parseJsonCell(row.correctAnswerJson),
    expectedAnswer: row.expectedAnswer || undefined,
    explanation: row.explanation || undefined,
    reasoning: row.reasoning || undefined,
    scoringRubric: parseJsonCell(row.scoringRubricJson),
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    weight: row.weight ? Number(row.weight) : undefined,
    estimatedTimeSec: row.estimatedTimeSec ? Number(row.estimatedTimeSec) : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(['ADMIN', 'ASSESSMENT_MANAGER']);
    const body = await req.json();
    const format: 'json' | 'csv' = body.format ?? 'json';

    let rawQuestions: unknown[];
    if (format === 'csv') {
      const parsed = Papa.parse<Record<string, string>>(body.content, { header: true, skipEmptyLines: true });
      rawQuestions = parsed.data.map(csvRowToQuestion);
    } else {
      rawQuestions = JSON.parse(body.content);
    }

    const result = questionArraySchema.safeParse(rawQuestions);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues.slice(0, 50).map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      );
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const q of result.data) {
      try {
        const existing = await prisma.question.findUnique({ where: { questionCode: q.questionCode } });
        const formInput = toFormInput(q);
        if (existing) {
          await updateQuestion(existing.id, formInput, session.userId, 'Bulk import update');
          updated++;
        } else {
          await createQuestion(formInput, session.userId);
          created++;
        }
      } catch (e) {
        errors.push(`${q.questionCode}: ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ created, updated, errors, total: result.data.length });
  } catch (err) {
    return apiError(err);
  }
}
