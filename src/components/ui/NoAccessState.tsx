'use client';

import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * What a page shows in place of its content when the backend refused its data
 * with a 403 (see `isForbiddenError`).
 *
 * Never the empty table: "No drivers" or "All clear" reads as an answer about
 * the fleet, when the truth is that this account may not see it.
 */
export function NoAccessState() {
  const { t } = useI18n();
  return (
    <Card className="mx-auto mt-6 max-w-md p-8 text-center" role="alert">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10">
        <ShieldAlert className="h-7 w-7 text-rose-500" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">
        {t('common.noAccessTitle')}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {t('common.noAccessDescription')}
      </p>
    </Card>
  );
}
