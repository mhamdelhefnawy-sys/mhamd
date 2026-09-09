'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QUESTION_FLAGS } from '@/lib/constants';

interface FlagRecord {
  id: string;
  flag: string;
  note: string | null;
  resolved: boolean;
  createdAt: string | Date;
}

export function QuestionFlagPanel({ questionId, flags }: { questionId: string; flags: FlagRecord[] }) {
  const router = useRouter();
  const [flag, setFlag] = useState<string>(QUESTION_FLAGS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = flags.filter((f) => !f.resolved);

  async function raise() {
    setSubmitting(true);
    await fetch(`/api/questions/${questionId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag, note }),
    });
    setSubmitting(false);
    setNote('');
    router.refresh();
  }

  async function resolve(flagRecordId: string) {
    await fetch(`/api/questions/${questionId}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagRecordId, resolutionNote: 'Resolved' }),
    });
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold text-ink-700">Quality Review Flags</h2>
      {open.length > 0 && (
        <ul className="mb-3 space-y-1">
          {open.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              <span>
                <b>{f.flag}</b> {f.note ? `— ${f.note}` : ''}
              </span>
              <button className="text-amber-600 underline" onClick={() => resolve(f.id)}>
                Resolve
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <select className="input w-40" value={flag} onChange={(e) => setFlag(e.target.value)}>
          {QUESTION_FLAGS.map((f) => (
            <option key={f} value={f}>
              {f.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <input className="input flex-1" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-secondary text-xs" onClick={raise} disabled={submitting}>
          Raise Flag
        </button>
      </div>
    </div>
  );
}
