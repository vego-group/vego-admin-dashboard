'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A request the backend refused: what failed, then why, in its own words
 * (see `failureLines` in @/lib/api-errors). For a form or picker that stays
 * open after the failure so the operator can fix it and retry.
 */
export function FailureNote({
  title,
  lines,
  className,
}: {
  title?: string;
  lines: string[];
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700',
        'dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {lines.map((line) => (
          <p key={line} className="break-words">{line}</p>
        ))}
      </div>
    </div>
  );
}
