'use client';

import { useRef, useState } from 'react';

interface Diagnostics {
  totalActivities: number;
  openEnds: { taskCode: string; taskName: string; reason: string }[];
  negativeFloat: { taskCode: string; taskName: string; totalFloatDays: number }[];
  highFloat: { taskCode: string; taskName: string; totalFloatDays: number }[];
  excessiveConstraints: { taskCode: string; taskName: string; constraintType: string }[];
  longDurations: { taskCode: string; taskName: string; durationDays: number }[];
  criticalCount: number;
  criticalPct: number;
  constraintPct: number;
  notApplicable: string[];
}
interface Schedule {
  projectName: string | null;
  activityCount: number;
  relationshipCount: number;
  calendarCount: number;
  wbsCount: number;
}

export default function PracticalP6Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const content = await file.text();
    const res = await fetch('/api/schedule-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, content }),
    });
    setBusy(false);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? 'Failed to parse file.');
      return;
    }
    setSchedule(d.schedule);
    setDiagnostics(d.diagnostics);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Practical P6 Lab</h1>
        <p className="text-sm text-ink-500">Upload a Primavera P6 .xer export to get schedule diagnostics — critical path, open ends, excessive constraints, high/negative float.</p>
      </div>

      <div className="card border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <b>Scope note:</b> this reads the activities, relationships, calendars and WBS already computed and saved inside the .xer file — it does not
        re-run Primavera&apos;s own scheduling engine. Every float/date/critical value shown is <b>&ldquo;as last computed by P6&rdquo;</b>, and every
        flag below (open ends, excessive constraints, etc.) is this platform&apos;s own analytical judgment, not a certified P6 result. Resource, cost and
        baseline import/comparison are architected (see <code>ScheduleImport</code> in the schema and <code>docs/XER_INTEGRATION.md</code>) but not yet
        implemented in this version.
      </div>

      <div className="card flex items-center gap-3 p-4">
        <input ref={fileRef} type="file" accept=".xer" className="text-sm" />
        <button className="btn-primary" onClick={upload} disabled={busy}>
          {busy ? 'Parsing…' : 'Upload & Analyze'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {schedule && diagnostics && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Activities" value={schedule.activityCount} />
            <Stat label="Relationships" value={schedule.relationshipCount} />
            <Stat label="Calendars" value={schedule.calendarCount} />
            <Stat label="WBS Nodes" value={schedule.wbsCount} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Critical Activities" value={`${diagnostics.criticalCount} (${diagnostics.criticalPct}%)`} />
            <Stat label="With Constraints" value={`${diagnostics.excessiveConstraints.length} (${diagnostics.constraintPct}%)`} />
            <Stat label="Open Ends" value={diagnostics.openEnds.length} tone={diagnostics.openEnds.length > 0 ? 'warn' : 'good'} />
          </div>

          <DiagTable title="Open Ends" rows={diagnostics.openEnds} cols={[['taskCode', 'Code'], ['taskName', 'Name'], ['reason', 'Reason']]} />
          <DiagTable
            title="Negative Float"
            rows={diagnostics.negativeFloat}
            cols={[['taskCode', 'Code'], ['taskName', 'Name'], ['totalFloatDays', 'Total Float (days)']]}
          />
          <DiagTable title="High Float (> 44 days)" rows={diagnostics.highFloat} cols={[['taskCode', 'Code'], ['taskName', 'Name'], ['totalFloatDays', 'Total Float (days)']]} />
          <DiagTable
            title="Excessive / Hard Constraints"
            rows={diagnostics.excessiveConstraints}
            cols={[['taskCode', 'Code'], ['taskName', 'Name'], ['constraintType', 'Constraint']]}
          />
          <DiagTable title="Long Durations (> 20 days)" rows={diagnostics.longDurations} cols={[['taskCode', 'Code'], ['taskName', 'Name'], ['durationDays', 'Duration (days)']]} />

          <div className="card p-4 text-xs text-ink-500">
            <b>Not computed (documented limitation):</b>
            <ul className="mt-1 list-inside list-disc">
              {diagnostics.notApplicable.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-ink-900';
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase text-ink-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function DiagTable<T extends Record<string, unknown>>({ title, rows, cols }: { title: string; rows: T[]; cols: [keyof T, string][] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <div className="border-b border-ink-100 p-4 text-sm font-semibold text-ink-700">
        {title} ({rows.length})
      </div>
      {rows.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              {cols.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={i}>
                {cols.map(([key, label]) => (
                  <td key={label}>{String(r[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="p-4 text-sm text-ink-400">None found.</div>
      )}
    </div>
  );
}
