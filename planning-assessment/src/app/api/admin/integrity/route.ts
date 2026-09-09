import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSession, apiError } from '@/lib/auth/guards';
import { AUTO_SCORED_TYPES } from '@/lib/constants';

/** §47 Data Integrity checks — run on demand from the Admin dashboard. */
export async function GET() {
  try {
    await requireSession(['ADMIN']);
    const findings: { severity: 'error' | 'warning'; message: string }[] = [];

    const questions = await prisma.question.findMany({ include: { options: true, category: true, competency: true } });

    const codeCounts = new Map<string, number>();
    for (const q of questions) codeCounts.set(q.questionCode, (codeCounts.get(q.questionCode) ?? 0) + 1);
    for (const [code, count] of codeCounts) if (count > 1) findings.push({ severity: 'error', message: `Duplicate questionCode: ${code} (${count} rows).` });

    for (const q of questions) {
      if (AUTO_SCORED_TYPES.includes(q.questionType as (typeof AUTO_SCORED_TYPES)[number])) {
        if (!q.correctAnswer) findings.push({ severity: 'error', message: `${q.questionCode}: auto-scored type with no correctAnswer.` });
        if (['MCQ', 'TRUE_FALSE', 'MULTI_SELECT'].includes(q.questionType) && !q.options.some((o) => o.isCorrect)) {
          findings.push({ severity: 'error', message: `${q.questionCode}: no option marked correct.` });
        }
      } else if (!q.scoringRubric) {
        findings.push({ severity: 'warning', message: `${q.questionCode}: open-ended type has no scoring rubric.` });
      }
      if (!q.explanation && !q.expectedAnswer) findings.push({ severity: 'warning', message: `${q.questionCode}: missing both explanation and expectedAnswer.` });
    }

    const competencies = await prisma.competency.findMany();
    const weightSum = competencies.reduce((s, c) => s + c.defaultWeight, 0);
    if (Math.abs(weightSum - 100) > 0.5) findings.push({ severity: 'error', message: `Competency weights sum to ${weightSum.toFixed(1)}, not 100.` });

    const categoriesWithoutQuestions = await prisma.category.findMany({ where: { questions: { none: {} } } });
    for (const c of categoriesWithoutQuestions) findings.push({ severity: 'warning', message: `Category "${c.name}" has zero questions.` });

    const orphanAnswers = await prisma.answer.count({ where: { assessmentQuestion: { is: undefined } } });
    if (orphanAnswers > 0) findings.push({ severity: 'error', message: `${orphanAnswers} Answer rows have no owning AssessmentQuestion.` });

    return NextResponse.json({
      findings,
      summary: { totalQuestions: questions.length, errors: findings.filter((f) => f.severity === 'error').length, warnings: findings.filter((f) => f.severity === 'warning').length },
    });
  } catch (err) {
    return apiError(err);
  }
}
