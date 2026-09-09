import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { AssessmentRunner } from '@/components/AssessmentRunner';
import { CompetencyRadar } from '@/components/charts/ChartKit';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';
import { COMPETENCY_GROUPS } from '@/lib/constants';
import { GenerateReportButton } from '@/components/GenerateReportButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AssessmentDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: {
      candidate: true,
      scores: { include: { competency: true } },
      reports: true,
    },
  });
  if (!assessment) notFound();
  if (session?.role === 'CANDIDATE' && assessment.candidateId !== session.candidateId) redirect('/assessments');

  if (assessment.status !== 'COMPLETED') {
    return <AssessmentRunner assessmentId={assessment.id} />;
  }

  const competencyScores = COMPETENCY_GROUPS.map((g) => {
    const row = assessment.scores.find((s) => s.scope === 'COMPETENCY' && s.competency?.code === g.code);
    return { competency: g.name, score: row ? Math.round(row.rawScore) : 0 };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{assessment.candidate.fullName}</h1>
            <p className="text-sm text-ink-500">
              {assessment.code} · {assessment.mode} · Completed {assessment.completedAt ? new Date(assessment.completedAt).toLocaleString() : ''}
            </p>
          </div>
          <div className="text-end">
            <div className="text-3xl font-bold text-brand-700">{assessment.overallScore?.toFixed(1)}%</div>
            <div className="text-sm font-medium text-ink-600">
              {assessment.recommendedLevel ? CLASSIFICATION_LEVEL_LABELS[assessment.recommendedLevel as keyof typeof CLASSIFICATION_LEVEL_LABELS] : '—'}
            </div>
            <div className="text-xs text-ink-400">Confidence: {assessment.confidenceLevel}</div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href={`/candidates/${assessment.candidateId}`} className="btn-secondary">
            View Candidate Profile
          </Link>
          {assessment.reports.length > 0 ? (
            <Link href={`/reports/${assessment.reports[0].id}`} className="btn-primary">
              View Report
            </Link>
          ) : (
            <GenerateReportButton assessmentId={assessment.id} />
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Competency Profile</h2>
        <CompetencyRadar data={competencyScores} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Competency</th>
              <th>Weight</th>
              <th>Score</th>
              <th>Questions</th>
              <th>Correct</th>
            </tr>
          </thead>
          <tbody>
            {COMPETENCY_GROUPS.map((g) => {
              const row = assessment.scores.find((s) => s.scope === 'COMPETENCY' && s.competency?.code === g.code);
              return (
                <tr key={g.code}>
                  <td>
                    {g.name} {g.isCritical && <span className="ms-1 text-xs text-amber-600">(critical)</span>}
                  </td>
                  <td>{g.weight}%</td>
                  <td>{row ? `${row.rawScore.toFixed(1)}%` : '—'}</td>
                  <td>{row?.questionsAnswered ?? 0}</td>
                  <td>{row?.questionsCorrect ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
