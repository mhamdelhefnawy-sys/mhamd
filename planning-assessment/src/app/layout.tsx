import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_DIR, type Locale } from '@/lib/i18n/config';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planning Engineer Competency Assessment Platform',
  description:
    'The complete Planning, Primavera P6 & Project Controls competency assessment ecosystem — adaptive testing, interview mode, and professional reporting.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = ((store.get(LOCALE_COOKIE)?.value as Locale) ?? DEFAULT_LOCALE) as Locale;

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]}>
      <body>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
