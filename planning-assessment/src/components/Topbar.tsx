'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { SessionPayload } from '@/lib/auth/token';

export function Topbar({ user }: { user: SessionPayload }) {
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-ink-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
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
        <div className="text-end">
          <div className="text-sm font-medium text-ink-900">{user.name}</div>
          <div className="text-xs text-ink-400">{t(`roles.${user.role}`)}</div>
        </div>
        <button onClick={logout} className="btn-ghost text-xs">
          {t('nav.logout')}
        </button>
      </div>
    </header>
  );
}
