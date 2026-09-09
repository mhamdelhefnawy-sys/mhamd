import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { KpiCard } from '@/components/KpiCard';
import { SimpleBarChart, SimplePieChart } from '@/components/charts/ChartKit';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';
import { COMPETENCY_GROUPS } from '@/lib/constants';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  const isCandidate = session?.role === 'CANDIDATE';

  const candidateFilter = isCandidate && session?.candidateId ? { candidateId: session.candidateId } : {};

  const [totalCandidates, totalAssessments, completed, allCompetencyScores, recent, questionCount] = await Promise.all([
    prisma.candidate.count(),
    prisma.assessment.count({ where: candidateFilter }),
    prisma.assessment.findMany({ where: { ...candidateFilter, status: 'COMPLETED' }, select: { overallScore: true, recommendedLevel: true } }),
    prisma.score.findMany({ where: { scope: 'COMPETENCY', assessment: candidateFilter }, include: { competency: true } }),
    prisma.assessment.findMany({
      where: candidateFilter,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { candidate: true },
    }),
    prisma.question.count({ where: { isActive: true, status: 'PUBLISHED' } }),
  ]);

  const avgScore = completed.length ? completed.reduce((s, c) => s + (c.overallScore ?? 0), 0) / completed.length : 0;
  const passCount = completed.filter((c) => c.overallScore != null && c.overallScore >= 55).length;
  const passRate = completed.length ? (passCount / completed.length) * 100 : 0;

  const levelCounts = new Map<string, number>();
  for (const c of completed) {
    if (!c.recommendedLevel) continue;
    levelCounts.set(c.recommendedLevel, (levelCounts.get(c.recommendedLevel) ?? 0) + 1);
  }
  const levelData = [...levelCounts.entries()].map(([level, value]) => ({
    name: CLASSIFICATION_LEVEL_LABELS[level as keyof typeof CLASSIFICATION_LEVEL_LABELS] ?? level,
    value,
  }));

  const competencyAgg = new Map<string, { sum: number; count: number }>();
  for (const s of allCompetencyScores) {
    const name = s.competency?.name ?? s.scopeKey ?? 'Unknown';
    const agg = competencyAgg.get(name) ?? { sum: 0, count: 0 };
    agg.sum += s.rawScore;
    agg.count += 1;
    competencyAgg.set(name, agg);
  }
  const competencyData = COMPETENCY_GROUPS.map((g) => {
    const agg = competencyAgg.get(g.name);
    return { name: g.name, value: agg ? Math.round(agg.sum / agg.count) : 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500">Welcome back, {session?.name}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Candidates" value={totalCandidates} />
        <KpiCard label="Assessments" value={totalAssessments} sub={`${completed.length} completed`} />
        <KpiCard label="Average Score" value={`${avgScore.toFixed(1)}%`} tone={avgScore >= 55 ? 'good' : 'warn'} />
        <KpiCard label="Pass Rate" value={`${passRate.toFixed(0)}%`} sub="Score ≥ 55" tone={passRate >= 50 ? 'good' : 'warn'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Level Distribution</h2>
          {levelData.length ? <SimplePieChart data={levelData} /> : <EmptyState text="No completed assessments yet." />}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Competency Performance (avg %)</h2>
          {allCompetencyScores.length ? <SimpleBarChart data={competencyData} horizontal /> : <EmptyState text="No competency scores yet." />}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-700">Recent Assessments</h2>
          <Link href="/assessments" className="text-xs font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState text="No assessments yet — start one from the Assessments page." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Score</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/assessments/${a.id}`} className="text-brand-600 hover:underline">
                      {a.candidate.fullName}
                    </Link>
                  </td>
                  <td>{a.mode}</td>
                  <td>{a.status}</td>
                  <td>{a.overallScore != null ? `${a.overallScore.toFixed(1)}%` : '—'}</td>
                  <td>{a.recommendedLevel ? CLASSIFICATION_LEVEL_LABELS[a.recommendedLevel as keyof typeof CLASSIFICATION_LEVEL_LABELS] : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-ink-400">{questionCount} published questions in the bank.</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-32 items-center justify-center text-sm text-ink-400">{text}</div>;
}
