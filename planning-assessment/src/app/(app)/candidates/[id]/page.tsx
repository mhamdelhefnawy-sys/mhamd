import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { COMPETENCY_GROUPS } from '@/lib/constants';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';
import { CompetencyRadar, SimpleBarChart } from '@/components/charts/ChartKit';

export const dynamic = 'force-dynamic';

export default async function CandidateProfilePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.role === 'CANDIDATE' && session.candidateId !== params.id) redirect('/dashboard');

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      assessments: {
        orderBy: { createdAt: 'desc' },
        include: { scores: { include: { competency: true } } },
      },
      reports: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!candidate) notFound();

  const completed = candidate.assessments.filter((a) => a.status === 'COMPLETED');
  const latest = completed[0];

  const competencyData = COMPETENCY_GROUPS.map((g) => {
    const row = latest?.scores.find((s) => s.scope === 'COMPETENCY' && s.competency?.code === g.code);
    return { competency: g.name, score: row ? Math.round(row.rawScore) : 0 };
  });

  const difficultyScores = latest?.scores.filter((s) => s.scope === 'DIFFICULTY').sort((a, b) => Number(a.scopeKey) - Number(b.scopeKey)) ?? [];
  const difficultyData = difficultyScores.map((s) => ({ name: `L${s.scopeKey}`, value: Math.round(s.rawScore) }));

  const scoreTrend = completed
    .slice()
    .reverse()
    .map((a) => ({ name: new Date(a.createdAt).toLocaleDateString(), value: Math.round(a.overallScore ?? 0) }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{candidate.fullName}</h1>
            <p className="text-sm text-ink-500">
              {candidate.currentPosition ?? 'No current position on file'} {candidate.targetPosition ? `→ targeting ${candidate.targetPosition}` : ''}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {candidate.email} {candidate.organization ? `· ${candidate.organization}` : ''} {candidate.yearsExperience ? `· ${candidate.yearsExperience} yrs experience` : ''}
            </p>
          </div>
          {latest && (
            <div className="text-end">
              <div className="text-3xl font-bold text-brand-700">{latest.overallScore?.toFixed(1)}%</div>
              <div className="text-sm font-semibold text-ink-700">{CLASSIFICATION_LEVEL_LABELS[latest.recommendedLevel as keyof typeof CLASSIFICATION_LEVEL_LABELS] ?? '—'}</div>
              <div className="text-xs text-ink-400">Confidence: {latest.confidenceLevel}</div>
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <Link href="/assessments/new" className="btn-primary">
            New Assessment
          </Link>
          {candidate.reports[0] && (
            <Link href={`/reports/${candidate.reports[0].id}`} className="btn-secondary">
              Latest Report
            </Link>
          )}
        </div>
      </div>

      {latest ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink-700">Competency Breakdown</h2>
              <CompetencyRadar data={competencyData} />
            </div>
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink-700">Performance by Difficulty Level</h2>
              {difficultyData.length ? <SimpleBarChart data={difficultyData} /> : <div className="flex h-64 items-center justify-center text-ink-400">No data</div>}
            </div>
          </div>
          {scoreTrend.length > 1 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink-700">Score Trend Across Assessments</h2>
              <SimpleBarChart data={scoreTrend} />
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center text-ink-400">No completed assessments yet.</div>
      )}

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-ink-100 p-4 text-sm font-semibold text-ink-700">Assessment History</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Score</th>
              <th>Level</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {candidate.assessments.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/assessments/${a.id}`} className="text-brand-600 hover:underline">
                    {a.code}
                  </Link>
                </td>
                <td>{a.mode}</td>
                <td>{a.status}</td>
                <td>{a.overallScore != null ? `${a.overallScore.toFixed(1)}%` : '—'}</td>
                <td>{a.recommendedLevel ? CLASSIFICATION_LEVEL_LABELS[a.recommendedLevel as keyof typeof CLASSIFICATION_LEVEL_LABELS] : '—'}</td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
