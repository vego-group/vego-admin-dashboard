'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Error boundary for every dashboard page.
 *
 * The (dashboard) layout is a bare fragment — each page mounts its own
 * `DashboardShell` — so this boundary mounts the shell itself. Otherwise a crash
 * would take the sidebar down with the page and leave nowhere to navigate to.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  // `console` rather than `logger`: the logger is silent in production builds,
  // and this is the one trace a tester on a deployed preview gets.
  useEffect(() => {
    console.error('[Dashboard] Page crashed:', error);
  }, [error]);

  return (
    <DashboardShell title={t('common.error')}>
      <Card className="mx-auto mt-6 max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">
          {t('common.pageError')}
        </h2>
        <Button
          variant="primary"
          className="mt-6"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={reset}
        >
          {t('common.retry')}
        </Button>
      </Card>
    </DashboardShell>
  );
}
