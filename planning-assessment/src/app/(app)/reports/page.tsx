import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const REC_TONE: Record<string, string> = {
  STRONGLY_RECOMMENDED: 'bg-emerald-100 text-emerald-700',
  RECOMMENDED: 'bg-emerald-50 text-emerald-600',
  RECOMMENDED_WITH_DEVELOPMENT: 'bg-amber-100 text-amber-700',
  BORDERLINE: 'bg-amber-100 text-amber-800',
  NOT_RECOMMENDED: 'bg-red-100 text-red-700',
};

export default async function ReportsPage() {
  const session = await getSession();
  const where = session?.role === 'CANDIDATE' ? { candidateId: session.candidateId } : {};
  const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, include: { candidate: true } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Reports</h1>
        <p className="text-sm text-ink-500">Generated assessment reports with competency matrix, recommendation, and PDF export.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Type</th>
              <th>Recommendation</th>
              <th>Generated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.candidate.fullName}</td>
                <td>{r.type.replace(/_/g, ' ')}</td>
                <td>
                  <span className={`badge ${REC_TONE[r.recommendation ?? ''] ?? 'bg-ink-100 text-ink-600'}`}>{(r.recommendation ?? '').replace(/_/g, ' ')}</span>
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link href={`/reports/${r.id}`} className="text-brand-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-400">
                  No reports generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
