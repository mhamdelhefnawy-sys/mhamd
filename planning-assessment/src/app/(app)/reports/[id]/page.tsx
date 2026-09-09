import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { fromJson } from '@/lib/json';
import type { ReportSummary } from '@/lib/engine/report';

export const dynamic = 'force-dynamic';

const REC_LABEL: Record<string, string> = {
  STRONGLY_RECOMMENDED: 'Strongly Recommended',
  RECOMMENDED: 'Recommended',
  RECOMMENDED_WITH_DEVELOPMENT: 'Recommended with Development',
  BORDERLINE: 'Borderline',
  NOT_RECOMMENDED: 'Not Recommended',
};

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) notFound();
  if (session?.role === 'CANDIDATE' && report.candidateId !== session.candidateId) redirect('/reports');

  const s = fromJson<ReportSummary | null>(report.summary, null);
  if (!s) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{s.candidate.fullName}</h1>
            <p className="text-sm text-ink-500">
              {s.candidate.currentPosition ?? 'Candidate'} {s.candidate.targetPosition ? `→ ${s.candidate.targetPosition}` : ''}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {s.assessment.code} · {s.assessment.mode} · {s.assessment.completedAt ? new Date(s.assessment.completedAt).toLocaleDateString() : ''}
              {s.assessment.durationMin != null ? ` · ${s.assessment.durationMin} min` : ''}
            </p>
          </div>
          <div className="text-end">
            <div className="text-3xl font-bold text-brand-700">{s.overallScore}%</div>
            <div className="text-sm font-semibold text-ink-700">{s.recommendedLevelLabel}</div>
          </div>
        </div>
        <a href={`/api/reports/${report.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary mt-4 inline-flex">
          Download PDF
        </a>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-700">Competency Matrix</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Competency</th>
              <th>Weight</th>
              <th>Score</th>
              <th>Critical</th>
            </tr>
          </thead>
          <tbody>
            {s.competencyMatrix.map((c) => (
              <tr key={c.code}>
                <td>{c.name}</td>
                <td>{c.weight}%</td>
                <td>{c.score}%</td>
                <td>{c.isCritical ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Strengths" items={s.strengths} tone="good" />
        <Section title="Development Areas" items={s.developmentAreas} tone="warn" />
      </div>

      {s.redFlags.length > 0 && <Section title="Red Flags" items={s.redFlags} tone="bad" />}
      {s.interviewerNotes.length > 0 && <Section title="Interviewer Notes" items={s.interviewerNotes} tone="default" />}

      <div className="card border-brand-200 bg-brand-50 p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Final Recommendation</div>
        <div className="mt-1 text-lg font-bold text-brand-800">{REC_LABEL[s.recommendation]}</div>
      </div>
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' | 'bad' | 'default' }) {
  const dot = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', default: 'text-ink-500' }[tone];
  return (
    <div className="card p-5">
      <h3 className="mb-2 text-sm font-semibold text-ink-700">{title}</h3>
      <ul className="space-y-1 text-sm text-ink-700">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={dot}>●</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
