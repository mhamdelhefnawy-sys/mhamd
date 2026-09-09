'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, COMPETENCY_GROUPS } from '@/lib/constants';

export default function TrainingPage() {
  const router = useRouter();
  const [categoryCodes, setCategoryCodes] = useState<string[]>([]);
  const [competencyCodes, setCompetencyCodes] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(15);
  const [submitting, setSubmitting] = useState(false);

  async function start() {
    setSubmitting(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'TRAINING', questionCount, categoryCodes, competencyCodes, isAdaptive: false }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const { assessment } = await res.json();
    router.push(`/assessments/${assessment.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Training Mode</h1>
        <p className="text-sm text-ink-500">Practice questions with the correct answer, reasoning, common mistakes and P6 checks shown immediately after each answer — no scoring pressure.</p>
      </div>

      <div className="card space-y-5 p-6">
        <div>
          <label className="label">Focus Competencies (optional)</label>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCY_GROUPS.map((g) => (
              <Chip key={g.code} active={competencyCodes.includes(g.code)} onClick={() => toggle(setCompetencyCodes, g.code)}>
                {g.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Focus Categories (optional)</label>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {CATEGORIES.map((c) => (
              <Chip key={c.code} active={categoryCodes.includes(c.code)} onClick={() => toggle(setCategoryCodes, c.code)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Number of Questions</label>
          <input className="input" type="number" min={5} max={100} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
        </div>
        <button className="btn-primary w-full" onClick={start} disabled={submitting}>
          {submitting ? 'Starting…' : 'Start Practice'}
        </button>
      </div>
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
