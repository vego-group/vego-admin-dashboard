'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en, { type Translations } from './locales/en';
import ar from './locales/ar';
import type { Direction, Locale } from '@/types';

const dictionaries: Record<Locale, Translations> = { en, ar };

const directionByLocale: Record<Locale, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  /** Lookup with dot-path key, e.g. t("dashboard.title"). Falls back to the key if missing. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'myvego.locale';

function resolvePath(obj: unknown, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj) as string | undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{{${k}}}`
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Hydrate locale from storage on first render
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'en' || stored === 'ar') {
      setLocaleState(stored);
    }
  }, []);

  // Sync html lang/dir whenever locale changes — works without page reload
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = directionByLocale[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback<I18nContextValue['t']>(
    (key, params) => {
      const value = resolvePath(dictionaries[locale], key);
      if (typeof value === 'string') return interpolate(value, params);
      // Fall back to English if key missing in current locale
      const fallback = resolvePath(dictionaries.en, key);
      if (typeof fallback === 'string') return interpolate(fallback, params);
      return key;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: directionByLocale[locale], setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
