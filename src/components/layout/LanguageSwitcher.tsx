'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50',
        'dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800',
        className
      )}
      style={{ borderColor: 'rgb(var(--border))' }}
      aria-label="Switch language"
    >
      <Languages className="h-3.5 w-3.5" />
      {locale === 'en' ? 'AR' : 'EN'}
    </button>
  );
}
