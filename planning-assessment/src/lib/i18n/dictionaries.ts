import en from './dictionaries/en.json';
import ar from './dictionaries/ar.json';
import type { Locale } from './config';

export const dictionaries = { en, ar } satisfies Record<Locale, unknown>;

export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return (dictionaries[locale] ?? dictionaries.en) as Dictionary;
}
