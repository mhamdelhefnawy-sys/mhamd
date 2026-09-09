import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { QuestionForm } from '@/components/QuestionForm';
import { fromJsonArray } from '@/lib/json';
import { QuestionFlagPanel } from '@/components/QuestionFlagPanel';

export const dynamic = 'force-dynamic';

export default async function EditQuestionPage({ params }: { params: { id: string } }) {
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { category: true, competency: true, options: true, versions: { orderBy: { versionNumber: 'desc' } }, flagRecords: { orderBy: { createdAt: 'desc' } } },
  });
  if (!question) notFound();

  const initial = {
    ...question,
    tags: fromJsonArray<string>(question.tags),
    commonMistakes: fromJsonArray<string>(question.commonMistakes),
    redFlags: fromJsonArray<string>(question.redFlags),
    p6Checks: fromJsonArray<string>(question.p6Checks),
    references: fromJsonArray<string>(question.references),
    followUpQuestions: fromJsonArray(question.followUpQuestions),
    scoringRubric: question.scoringRubric ? JSON.parse(question.scoringRubric) : null,
    correctAnswer: question.correctAnswer ? JSON.parse(question.correctAnswer) : null,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">Edit Question — {question.questionCode}</h1>
        <span className="text-xs text-ink-400">v{question.version} · updated {new Date(question.updatedAt).toLocaleString()}</span>
      </div>
      <QuestionFlagPanel questionId={question.id} flags={question.flagRecords} />
      <QuestionForm initial={initial} />
      {question.versions.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Version History</h2>
          <ul className="space-y-1 text-xs text-ink-500">
            {question.versions.map((v) => (
              <li key={v.id}>
                v{v.versionNumber} · {new Date(v.createdAt).toLocaleString()} {v.changeNote ? `— ${v.changeNote}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
