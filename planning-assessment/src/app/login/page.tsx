'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@peassess.io' },
  { role: 'Assessment Manager', email: 'manager@peassess.io' },
  { role: 'Interviewer', email: 'interviewer@peassess.io' },
  { role: 'Candidate (Senior, strong P6)', email: 'candidate.strong@peassess.io' },
  { role: 'Candidate (weak Delay Analysis)', email: 'candidate.gap@peassess.io' },
  { role: 'Viewer', email: 'viewer@peassess.io' },
];
const DEMO_PASSWORD = 'Passw0rd!123';

export default function LoginPage() {
  const { t, locale, setLocale, dir } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(t('auth.invalidCredentials'));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 to-brand-900 px-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-ink-900 p-10 text-white md:flex">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-300">Planning &middot; P6 &middot; Project Controls</div>
            <h1 className="mt-4 text-2xl font-bold leading-snug">{t('app.name')}</h1>
            <p className="mt-4 text-sm text-ink-300">{t('auth.loginSubtitle')}</p>
          </div>
          <ul className="mt-8 space-y-2 text-sm text-ink-300">
            <li>• Adaptive assessment engine across 8 weighted competencies</li>
            <li>• Interview mode with live follow-up questioning</li>
            <li>• 600+ scenario-based Planning / P6 / EVM / Delay questions</li>
            <li>• Candidate competency profiling &amp; PDF reports</li>
          </ul>
        </div>
        <div className="p-8 md:p-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink-900">{t('auth.loginTitle')}</h2>
            <div className="flex overflow-hidden rounded-lg border border-ink-200 text-xs">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-2.5 py-1 ${locale === 'en' ? 'bg-brand-600 text-white' : 'text-ink-500'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('ar')}
                className={`px-2.5 py-1 ${locale === 'ar' ? 'bg-brand-600 text-white' : 'text-ink-500'}`}
              >
                عربي
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" type="submit" disabled={loading}>
              {loading ? t('common.loading') : t('auth.login')}
            </button>
          </form>

          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('auth.demoAccounts')}</p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex items-center justify-between rounded-md border border-ink-100 px-2.5 py-1.5 text-start hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="font-medium text-ink-700">{acc.role}</span>
                  <span className="text-ink-400" dir="ltr">{acc.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-400" dir="ltr">
              Password for every demo account: {DEMO_PASSWORD}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
