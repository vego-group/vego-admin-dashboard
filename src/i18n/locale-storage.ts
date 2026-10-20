import type { Locale } from '@/types';

/** Where the UI language is kept between visits. */
export const LOCALE_STORAGE_KEY = 'myvego.locale';

/**
 * The stored UI language, or **null** when none is stored or storage is blocked.
 *
 * Shared by the I18nProvider and the API client: the client reads it on every
 * request, outside React, so a language switch reaches the very next call.
 */
export function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === 'en' || stored === 'ar' ? stored : null;
  } catch {
    return null;
  }
}
