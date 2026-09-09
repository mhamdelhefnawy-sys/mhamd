import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InterviewListPage() {
  const interviews = await prisma.interview.findMany({
    orderBy: { createdAt: 'desc' },
    include: { candidate: true, interviewer: true, assessment: { select: { status: true, overallScore: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Interview Mode</h1>
          <p className="text-sm text-ink-500">Interviewer-controlled structured interviews with live scoring and follow-up questioning.</p>
        </div>
        <Link href="/interview/new" className="btn-primary">
          + New Interview
        </Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Position</th>
              <th>Interviewer</th>
              <th>Status</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => (
              <tr key={iv.id}>
                <td>
                  <Link href={`/interview/${iv.id}`} className="font-medium text-brand-600 hover:underline">
                    {iv.candidate.fullName}
                  </Link>
                </td>
                <td>{iv.position}</td>
                <td>{iv.interviewer.name}</td>
                <td>
                  <span className="badge bg-ink-100 text-ink-600">{iv.status.replace('_', ' ')}</span>
                </td>
                <td>{iv.assessment?.overallScore != null ? `${iv.assessment.overallScore.toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-400">
                  No interviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
