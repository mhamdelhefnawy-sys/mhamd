'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ASSESSMENT_MODE_META, ASSESSMENT_MODES, CATEGORIES, COMPETENCY_GROUPS, type AssessmentMode } from '@/lib/constants';

interface Candidate {
  id: string;
  fullName: string;
  email: string;
  targetPosition?: string | null;
}

export default function NewAssessmentPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [mode, setMode] = useState<AssessmentMode>('STANDARD');
  const [questionCount, setQuestionCount] = useState<number | ''>('');
  const [categoryCodes, setCategoryCodes] = useState<string[]>([]);
  const [competencyCodes, setCompetencyCodes] = useState<string[]>([]);
  const [isAdaptive, setIsAdaptive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setRole(d.user?.role ?? null));
    fetch('/api/candidates')
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []));
  }, []);

  useEffect(() => {
    setIsAdaptive(!['TRAINING', 'INTERVIEW'].includes(mode));
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId: role === 'CANDIDATE' ? undefined : candidateId,
        mode,
        questionCount: questionCount || undefined,
        categoryCodes: mode === 'CUSTOM' && categoryCodes.length ? categoryCodes : undefined,
        competencyCodes: mode === 'CUSTOM' && competencyCodes.length ? competencyCodes : undefined,
        isAdaptive,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create assessment.');
      return;
    }
    const { assessment } = await res.json();
    router.push(`/assessments/${assessment.id}`);
  }

  const meta = ASSESSMENT_MODE_META[mode];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">New Assessment</h1>
        <p className="text-sm text-ink-500">Configure and launch an assessment run.</p>
      </div>

      <form onSubmit={submit} className="card space-y-5 p-6">
        {role && role !== 'CANDIDATE' && (
          <div>
            <label className="label">Candidate</label>
            <select className="input" required value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
              <option value="">Select a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-400">
              No candidate yet? <a href="/candidates" className="text-brand-600 hover:underline">Add one first</a>.
            </p>
          </div>
        )}

        <div>
          <label className="label">Assessment Mode</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ASSESSMENT_MODES.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg border p-2.5 text-start text-xs ${mode === m ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}
              >
                <div className="font-semibold text-ink-800">
                  {ASSESSMENT_MODE_META[m].code}. {ASSESSMENT_MODE_META[m].label}
                </div>
                <div className="mt-0.5 text-ink-400">{ASSESSMENT_MODE_META[m].questionRange.join('–')} questions</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">{meta.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Question Count ({meta.questionRange.join('–')})</label>
            <input
              type="number"
              className="input"
              min={meta.questionRange[0]}
              max={meta.questionRange[1]}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value ? Number(e.target.value) : '')}
              placeholder={`Default: ${Math.round((meta.questionRange[0] + meta.questionRange[1]) / 2)}`}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input id="adaptive" type="checkbox" checked={isAdaptive} onChange={(e) => setIsAdaptive(e.target.checked)} />
            <label htmlFor="adaptive" className="text-sm text-ink-700">
              Adaptive difficulty
            </label>
          </div>
        </div>

        {mode === 'CUSTOM' && (
          <>
            <div>
              <label className="label">Competencies (leave empty = all)</label>
              <div className="flex flex-wrap gap-1.5">
                {COMPETENCY_GROUPS.map((g) => (
                  <Chip key={g.code} active={competencyCodes.includes(g.code)} onClick={() => toggle(setCompetencyCodes, g.code)}>
                    {g.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Categories (leave empty = all)</label>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {CATEGORIES.map((c) => (
                  <Chip key={c.code} active={categoryCodes.includes(c.code)} onClick={() => toggle(setCategoryCodes, c.code)}>
                    {c.name}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Creating…' : 'Start Assessment'}
        </button>
      </form>
    </div>
  );
}

function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, code: string) {
  setter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-200 text-ink-600 hover:border-ink-300'}`}
    >
      {children}
    </button>
  );
}
