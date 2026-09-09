'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CATEGORIES, CAREER_LEVELS, COMPETENCY_GROUPS, DIFFICULTY_LEVELS, QUESTION_STATUSES, QUESTION_TYPES } from '@/lib/constants';
import { ImportExportPanel } from '@/components/ImportExportPanel';

interface QuestionRow {
  id: string;
  questionCode: string;
  question: string;
  category: { name: string; code: string };
  competency: { name: string; code: string };
  difficulty: number;
  careerLevel: string;
  questionType: string;
  status: string;
  isActive: boolean;
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-ink-100 text-ink-600',
  REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-sky-100 text-sky-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export default function QuestionBankPage() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category: '', competency: '', difficulty: '', careerLevel: '', questionType: '', status: '', q: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [showImportExport, setShowImportExport] = useState(false);
  const pageSize = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const res = await fetch(`/api/questions?${params.toString()}`);
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.questions);
    setTotal(d.total);
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function bulk(action: string) {
    if (selected.length === 0) return;
    if (action === 'delete' && !confirm(`Delete ${selected.length} question(s)? This cannot be undone.`)) return;
    await fetch('/api/questions/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected, action }) });
    setSelected([]);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Question Bank</h1>
          <p className="text-sm text-ink-500">{total} questions in the database.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImportExport((v) => !v)}>
            Import / Export
          </button>
          <Link href="/question-bank/new" className="btn-primary">
            + New Question
          </Link>
        </div>
      </div>

      {showImportExport && <ImportExportPanel onImported={load} />}

      <div className="card flex flex-wrap gap-2 p-3">
        <select className="input w-auto" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.competency} onChange={(e) => setFilters({ ...filters, competency: e.target.value })}>
          <option value="">All Competencies</option>
          {COMPETENCY_GROUPS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
          <option value="">All Difficulties</option>
          {DIFFICULTY_LEVELS.map((d) => (
            <option key={d} value={d}>
              L{d}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.careerLevel} onChange={(e) => setFilters({ ...filters, careerLevel: e.target.value })}>
          <option value="">All Levels</option>
          {CAREER_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.questionType} onChange={(e) => setFilters({ ...filters, questionType: e.target.value })}>
          <option value="">All Types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className="input w-64" placeholder="Search…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
      </div>

      {selected.length > 0 && (
        <div className="card flex items-center gap-2 p-3 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <button className="btn-secondary text-xs" onClick={() => bulk('activate')}>
            Activate
          </button>
          <button className="btn-secondary text-xs" onClick={() => bulk('deactivate')}>
            Deactivate
          </button>
          <button className="btn-secondary text-xs" onClick={() => bulk('archive')}>
            Archive
          </button>
          <button className="btn-secondary text-xs" onClick={() => bulk('duplicate')}>
            Duplicate
          </button>
          <button className="btn-danger text-xs" onClick={() => bulk('delete')}>
            Delete
          </button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selected.length === rows.length && rows.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th>Code</th>
              <th>Question</th>
              <th>Category</th>
              <th>Competency</th>
              <th>Diff.</th>
              <th>Level</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))}
                  />
                </td>
                <td>
                  <Link href={`/question-bank/${r.id}`} className="font-medium text-brand-600 hover:underline">
                    {r.questionCode}
                  </Link>
                </td>
                <td className="max-w-md truncate">{r.question}</td>
                <td>{r.category.name}</td>
                <td>{r.competency.name}</td>
                <td>L{r.difficulty}</td>
                <td>{r.careerLevel}</td>
                <td>{r.questionType.replace(/_/g, ' ')}</td>
                <td>
                  <span className={`badge ${STATUS_TONE[r.status] ?? ''}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-ink-400">
                  No questions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn-secondary text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
