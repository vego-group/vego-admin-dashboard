'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{t('notFound.title')}</h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          {t('notFound.description')}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-950 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-900 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {t('notFound.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
