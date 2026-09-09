'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateReportButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId }),
    });
    setLoading(false);
    if (!res.ok) return;
    const { report } = await res.json();
    router.push(`/reports/${report.id}`);
  }

  return (
    <button className="btn-primary" onClick={generate} disabled={loading}>
      {loading ? 'Generating…' : 'Generate Report'}
    </button>
  );
}
