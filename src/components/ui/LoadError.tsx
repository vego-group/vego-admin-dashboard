'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';

/**
 * Data that failed to load, said as such, with a way to ask again. A failed
 * load must never look like an empty list or a row of zeros.
 */
export function LoadError({
  title,
  lines = [],
  onRetry,
  retrying = false,
  className,
}: {
  title: string;
  /** Why, e.g. from `failureLines()`. */
  lines?: string[];
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700',
        'dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">{title}</p>
          {lines.map((line) => (
            <p key={line} className="break-words text-xs">{line}</p>
          ))}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-500/10"
        >
          <RotateCw className={cn('h-3.5 w-3.5', retrying && 'animate-spin')} />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
