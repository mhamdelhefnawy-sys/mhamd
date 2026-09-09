import { computeAnalyticsOverview } from '@/lib/engine/analytics';
import { KpiCard } from '@/components/KpiCard';
import { SimpleBarChart } from '@/components/charts/ChartKit';
import { CLASSIFICATION_LEVEL_LABELS } from '@/lib/engine/classification';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const data = await computeAnalyticsOverview();

  const levelData = Object.entries(data.levelCounts).map(([level, value]) => ({
    name: CLASSIFICATION_LEVEL_LABELS[level as keyof typeof CLASSIFICATION_LEVEL_LABELS] ?? level,
    value,
  }));
  const competencyData = data.competencyAvg.map((c) => ({ name: c.name, value: c.avg }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Analytics</h1>
        <p className="text-sm text-ink-500">Candidate, competency, level, and question-level performance across the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Candidates" value={data.candidateCount} />
        <KpiCard label="Completed Assessments" value={data.assessmentCount} />
        <KpiCard label="Average Score" value={`${data.avgScore}%`} />
        <KpiCard label="Pass Rate" value={`${data.passRate}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Competency Performance (avg %)</h2>
          <SimpleBarChart data={competencyData} horizontal />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Level Distribution</h2>
          {levelData.length ? <SimpleBarChart data={levelData} horizontal /> : <div className="flex h-64 items-center justify-center text-ink-400">No data yet.</div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Strongest Competencies</h2>
          <List items={data.strongest.map((c) => `${c.name} — ${c.avg}%`)} tone="good" />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Weakest Competencies</h2>
          <List items={data.weakest.map((c) => `${c.name} — ${c.avg}%`)} tone="bad" />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-ink-100 p-4 text-sm font-semibold text-ink-700">Most Frequently Missed Questions</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>Difficulty</th>
              <th>Avg Score</th>
              <th>Sample Size</th>
            </tr>
          </thead>
          <tbody>
            {data.mostMissed.map((q) => (
              <tr key={q.id}>
                <td>{q.questionCode}</td>
                <td>{q.category}</td>
                <td>L{q.difficulty}</td>
                <td>{q.avgPct}%</td>
                <td>{q.n}</td>
              </tr>
            ))}
            {data.mostMissed.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-400">
                  No answered questions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FlagTable title="Flagged: Possibly Too Easy (≥92% correct, n≥5)" rows={data.flaggedTooEasy} />
        <FlagTable title="Flagged: Possibly Too Hard (≤15% correct, n≥5)" rows={data.flaggedTooHard} />
      </div>
    </div>
  );
}

function List({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.length === 0 && <li className="text-ink-400">Not enough data yet.</li>}
      {items.map((it, i) => (
        <li key={i} className={tone === 'good' ? 'text-emerald-700' : 'text-red-700'}>
          {it}
        </li>
      ))}
    </ul>
  );
}

function FlagTable({ title, rows }: { title: string; rows: { id: string; questionCode: string; correctRate: number; n: number }[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <div className="border-b border-ink-100 p-4 text-sm font-semibold text-ink-700">{title}</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Correct Rate</th>
            <th>n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.questionCode}</td>
              <td>{r.correctRate}%</td>
              <td>{r.n}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-ink-400">
                None flagged.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
