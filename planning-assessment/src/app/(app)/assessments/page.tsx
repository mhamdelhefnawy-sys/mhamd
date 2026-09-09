import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { ASSESSMENT_MODE_META } from '@/lib/constants';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  NOT_STARTED: 'bg-ink-100 text-ink-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ABANDONED: 'bg-red-100 text-red-700',
};

export default async function AssessmentsPage() {
  const session = await getSession();
  const where = session?.role === 'CANDIDATE' ? { candidateId: session.candidateId } : {};
  const assessments = await prisma.assessment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { candidate: true, _count: { select: { questions: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Assessments</h1>
          <p className="text-sm text-ink-500">Quick Test, Standard, Full, Certification, Senior/Manager, Practical P6, Training &amp; Custom modes.</p>
        </div>
        <Link href="/assessments/new" className="btn-primary">
          + New Assessment
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Candidate</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Questions</th>
              <th>Score</th>
              <th>Level</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/assessments/${a.id}`} className="font-medium text-brand-600 hover:underline">
                    {a.code}
                  </Link>
                </td>
                <td>{a.candidate.fullName}</td>
                <td>{ASSESSMENT_MODE_META[a.mode as keyof typeof ASSESSMENT_MODE_META]?.label ?? a.mode}</td>
                <td>
                  <span className={`badge ${STATUS_TONE[a.status] ?? 'bg-ink-100 text-ink-600'}`}>{a.status.replace('_', ' ')}</span>
                </td>
                <td>{a._count.questions}</td>
                <td>{a.overallScore != null ? `${a.overallScore.toFixed(1)}%` : '—'}</td>
                <td>{a.recommendedLevel ? CLASSIFICATION_LEVEL_LABELS[a.recommendedLevel as keyof typeof CLASSIFICATION_LEVEL_LABELS] : '—'}</td>
                <td>{a.startedAt ? new Date(a.startedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {assessments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-400">
                  No assessments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
