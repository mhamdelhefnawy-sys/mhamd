'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Finding {
  severity: 'error' | 'warning';
  message: string;
}

export default function AdminPage() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [summary, setSummary] = useState<{ totalQuestions: number; errors: number; warnings: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    const res = await fetch('/api/admin/integrity');
    const d = await res.json();
    setFindings(d.findings ?? []);
    setSummary(d.summary ?? null);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Administration</h1>
        <p className="text-sm text-ink-500">Users, question-bank governance, and platform-wide data integrity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminCard href="/admin/users" title="Users" desc="Manage accounts and roles (Admin, Assessment Manager, Interviewer, Candidate, Viewer)." />
        <AdminCard href="/question-bank" title="Question Bank" desc="Full question CRUD, import/export, versioning, review flags." />
        <AdminCard href="/competencies" title="Competency Framework" desc="Scoring weights and level-classification thresholds." />
        <AdminCard href="/analytics" title="Analytics" desc="Item difficulty, discrimination, competency & level performance." />
        <AdminCard href="/practical-p6" title="Practical P6 Lab" desc="Schedule import architecture (XER) and diagnostics." />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-700">Data Integrity Check (§47)</h2>
          <button className="btn-secondary text-xs" onClick={runCheck} disabled={loading}>
            {loading ? 'Running…' : 'Run Check'}
          </button>
        </div>
        {summary && (
          <div className="mb-3 flex gap-4 text-sm">
            <span>Total questions: {summary.totalQuestions}</span>
            <span className="text-red-600">{summary.errors} errors</span>
            <span className="text-amber-600">{summary.warnings} warnings</span>
          </div>
        )}
        {findings && (
          <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">
            {findings.length === 0 && <li className="text-emerald-600">No issues found.</li>}
            {findings.map((f, i) => (
              <li key={i} className={f.severity === 'error' ? 'text-red-600' : 'text-amber-600'}>
                [{f.severity}] {f.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card p-4 transition-shadow hover:shadow-lg">
      <div className="text-sm font-semibold text-ink-800">{title}</div>
      <div className="mt-1 text-xs text-ink-500">{desc}</div>
    </Link>
  );
}
