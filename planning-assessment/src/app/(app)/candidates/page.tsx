import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CandidatesPage() {
  const session = await getSession();
  if (session?.role === 'CANDIDATE') redirect(`/candidates/${session.candidateId}`);

  const candidates = await prisma.candidate.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assessments: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Candidates</h1>
          <p className="text-sm text-ink-500">All candidates registered in the platform.</p>
        </div>
        <Link href="/candidates/new" className="btn-primary">
          + Add Candidate
        </Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Current Position</th>
              <th>Target Position</th>
              <th>Assessments</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/candidates/${c.id}`} className="font-medium text-brand-600 hover:underline">
                    {c.fullName}
                  </Link>
                </td>
                <td>{c.email}</td>
                <td>{c.currentPosition ?? '—'}</td>
                <td>{c.targetPosition ?? '—'}</td>
                <td>{c._count.assessments}</td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-400">
                  No candidates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
