'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_LEVEL_LABELS } from '@/lib/constants';

export default function NewCandidatePage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', currentPosition: '', targetPosition: '', yearsExperience: '', primaryProjectType: '', organization: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create candidate.');
      return;
    }
    const { candidate } = await res.json();
    router.push(`/candidates/${candidate.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-ink-900">Add Candidate</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label">Full Name</label>
          <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Current Position</label>
            <input className="input" value={form.currentPosition} onChange={(e) => setForm({ ...form, currentPosition: e.target.value })} />
          </div>
          <div>
            <label className="label">Target Position</label>
            <select className="input" value={form.targetPosition} onChange={(e) => setForm({ ...form, targetPosition: e.target.value })}>
              <option value="">Select…</option>
              {Object.values(CAREER_LEVEL_LABELS).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Years of Experience</label>
            <input className="input" type="number" min={0} step="0.5" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} />
          </div>
          <div>
            <label className="label">Primary Project Type</label>
            <input className="input" placeholder="e.g. High-rise, Infrastructure, Oil & Gas" value={form.primaryProjectType} onChange={(e) => setForm({ ...form, primaryProjectType: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Organization</label>
          <input className="input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create Candidate'}
        </button>
      </form>
    </div>
  );
}
