'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAREER_LEVELS, CAREER_LEVEL_LABELS, COMPETENCY_GROUPS } from '@/lib/constants';

interface Candidate {
  id: string;
  fullName: string;
  email: string;
}

export default function NewInterviewPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [position, setPosition] = useState('Senior Planning Engineer');
  const [projectType, setProjectType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('SENIOR');
  const [plannedDurationMin, setPlannedDurationMin] = useState(45);
  const [questionCount, setQuestionCount] = useState(20);
  const [competenciesFocus, setCompetenciesFocus] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/candidates')
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, position, projectType, experienceLevel, plannedDurationMin, questionCount, competenciesFocus }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create interview.');
      return;
    }
    const { interview } = await res.json();
    router.push(`/interview/${interview.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-ink-900">New Interview</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label">Candidate</label>
          <select className="input" required value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.email}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Candidate Position</label>
            <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div>
            <label className="label">Project Type</label>
            <input className="input" placeholder="e.g. Infrastructure, EPC" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Experience Level</label>
            <select className="input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
              {CAREER_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {CAREER_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Duration (min)</label>
            <input className="input" type="number" value={plannedDurationMin} onChange={(e) => setPlannedDurationMin(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Question Count</label>
            <input className="input" type="number" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label">Competencies to Focus (leave empty = all)</label>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCY_GROUPS.map((g) => (
              <button
                type="button"
                key={g.code}
                onClick={() => setCompetenciesFocus((prev) => (prev.includes(g.code) ? prev.filter((c) => c !== g.code) : [...prev, g.code]))}
                className={`rounded-full border px-2.5 py-1 text-xs ${competenciesFocus.includes(g.code) ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-200 text-ink-600'}`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Starting…' : 'Start Interview'}
        </button>
      </form>
    </div>
  );
}
