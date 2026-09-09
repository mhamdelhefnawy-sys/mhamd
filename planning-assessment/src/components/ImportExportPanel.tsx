'use client';

import { useRef, useState } from 'react';

export function ImportExportPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    const content = await file.text();
    const res = await fetch('/api/questions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, content }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setResult(`Failed: ${d.error ?? 'unknown error'}${d.issues ? '\n' + d.issues.join('\n') : ''}`);
      return;
    }
    setResult(`Imported: ${d.created} created, ${d.updated} updated, ${d.errors?.length ?? 0} error(s) out of ${d.total}.`);
    onImported();
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-ink-700">Import / Export Question Bank</h2>
      <p className="text-xs text-ink-500">Structured JSON or CSV import/export — the same pipeline the seed data uses, so the bank can grow past 500 → 1,000 → 5,000+ questions without any architecture change.</p>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/questions/export?format=json" className="btn-secondary text-xs">
          Export JSON
        </a>
        <a href="/api/questions/export?format=csv" className="btn-secondary text-xs">
          Export CSV
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}>
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
        <input ref={fileRef} type="file" accept={format === 'json' ? '.json' : '.csv'} className="text-xs" />
        <button className="btn-primary text-xs" onClick={handleImport} disabled={busy}>
          {busy ? 'Importing…' : 'Import File'}
        </button>
      </div>
      {result && <pre className="whitespace-pre-wrap rounded bg-ink-50 p-2 text-xs text-ink-600">{result}</pre>}
    </div>
  );
}
