'use client';

import { useEffect, useState } from 'react';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';

interface Competency {
  code: string;
  name: string;
  group: string;
  defaultWeight: number;
  isCritical: boolean;
  _count: { questions: number };
}
interface Threshold {
  level: string;
  order: number;
  minOverallScore: number;
  minCriticalCompetencyScore: string;
}

export default function CompetenciesPage() {
  const [role, setRole] = useState<string | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setRole(d.user?.role ?? null));
    fetch('/api/competencies').then((r) => r.json()).then((d) => setCompetencies(d.competencies ?? []));
    fetch('/api/admin/level-thresholds').then((r) => r.json()).then((d) => setThresholds(d.thresholds ?? []));
  }, []);

  const weightSum = competencies.reduce((s, c) => s + c.defaultWeight, 0);
  const isAdmin = role === 'ADMIN';

  async function saveWeights() {
    setSavingWeights(true);
    setMsg(null);
    const res = await fetch('/api/competencies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competencies: competencies.map((c) => ({ code: c.code, defaultWeight: c.defaultWeight, isCritical: c.isCritical })) }),
    });
    setSavingWeights(false);
    const d = await res.json();
    setMsg(res.ok ? 'Weights saved.' : d.error);
  }

  async function saveThresholds() {
    setSavingThresholds(true);
    const res = await fetch('/api/admin/level-thresholds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thresholds: thresholds.map((t) => ({ level: t.level, minOverallScore: t.minOverallScore, minCriticalCompetencyScore: JSON.parse(t.minCriticalCompetencyScore || '{}') })),
      }),
    });
    setSavingThresholds(false);
    setMsg(res.ok ? 'Level thresholds saved.' : 'Failed to save thresholds.');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Competency Framework</h1>
        <p className="text-sm text-ink-500">The 8 weighted competency groups that drive scoring (§28) and the level-classification gates (§29). Critical competencies must independently clear a level&apos;s threshold — a high overall score alone cannot buy a Senior classification.</p>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-700">Competency Weights</h2>
          <span className={`text-xs font-semibold ${Math.abs(weightSum - 100) < 0.5 ? 'text-emerald-600' : 'text-red-600'}`}>Total: {weightSum.toFixed(1)}%</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Competency</th>
              <th>Weight %</th>
              <th>Critical</th>
              <th>Questions</th>
            </tr>
          </thead>
          <tbody>
            {competencies.map((c, i) => (
              <tr key={c.code}>
                <td>{c.name}</td>
                <td>
                  <input
                    className="input w-24"
                    type="number"
                    step="0.5"
                    disabled={!isAdmin}
                    value={c.defaultWeight}
                    onChange={(e) => setCompetencies((prev) => prev.map((p, j) => (j === i ? { ...p, defaultWeight: Number(e.target.value) } : p)))}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={c.isCritical}
                    onChange={(e) => setCompetencies((prev) => prev.map((p, j) => (j === i ? { ...p, isCritical: e.target.checked } : p)))}
                  />
                </td>
                <td>{c._count?.questions ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <button className="btn-primary mt-3" onClick={saveWeights} disabled={savingWeights}>
            {savingWeights ? 'Saving…' : 'Save Weights'}
          </button>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-700">Level Classification Thresholds</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Min Overall Score</th>
            </tr>
          </thead>
          <tbody>
            {thresholds
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((t) => (
                <tr key={t.level}>
                  <td>{CLASSIFICATION_LEVEL_LABELS[t.level as keyof typeof CLASSIFICATION_LEVEL_LABELS] ?? t.level}</td>
                  <td>
                    <input
                      className="input w-24"
                      type="number"
                      disabled={!isAdmin}
                      value={t.minOverallScore}
                      onChange={(e) => setThresholds((prev) => prev.map((p) => (p.level === t.level ? { ...p, minOverallScore: Number(e.target.value) } : p)))}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {isAdmin && (
          <button className="btn-primary mt-3" onClick={saveThresholds} disabled={savingThresholds}>
            {savingThresholds ? 'Saving…' : 'Save Thresholds'}
          </button>
        )}
      </div>

      {msg && <p className="text-sm text-brand-700">{msg}</p>}
    </div>
  );
}
