'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Role } from '@/lib/constants';
import clsx from 'clsx';

interface NavItem {
  href: string;
  labelKey: string;
  roles?: Role[];
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: '▦' },
  { href: '/assessments', labelKey: 'nav.assessments', icon: '✓' },
  { href: '/interview', labelKey: 'nav.interview', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER'], icon: '⚖' },
  { href: '/question-bank', labelKey: 'nav.questionBank', roles: ['ADMIN', 'ASSESSMENT_MANAGER'], icon: '≡' },
  { href: '/competencies', labelKey: 'nav.competencies', roles: ['ADMIN', 'ASSESSMENT_MANAGER'], icon: '◈' },
  { href: '/candidates', labelKey: 'nav.candidates', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'INTERVIEWER', 'VIEWER'], icon: '▤' },
  { href: '/reports', labelKey: 'nav.reports', icon: '☷' },
  { href: '/training', labelKey: 'nav.training', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'CANDIDATE'], icon: '✳' },
  { href: '/practical-p6', labelKey: 'nav.practicalP6', icon: '⚙' },
  { href: '/analytics', labelKey: 'nav.analytics', roles: ['ADMIN', 'ASSESSMENT_MANAGER', 'VIEWER'], icon: '☷' },
  { href: '/admin', labelKey: 'nav.administration', roles: ['ADMIN'], icon: '⚙' },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="hidden w-64 shrink-0 border-e border-ink-200 bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b border-ink-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">PE</div>
        <div className="text-sm font-semibold leading-tight text-ink-900">{t('app.shortName')}</div>
      </div>
      <nav className="space-y-0.5 p-3">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              <span className="w-4 text-center text-ink-400">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
