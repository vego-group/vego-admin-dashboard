'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n/I18nProvider';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Disables every button, e.g. while the next page is loading. */
  disabled?: boolean;
}

/**
 * The page numbers to show: the first, the last, and the current page with one
 * neighbour on each side, with `null` for each gap. This used to render pages
 * 1–8 whatever the total, so page 9 and beyond were never highlighted and could
 * only be reached with "Next" (FA-011). Server-paged lists can run long.
 */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export function Pagination({ currentPage, totalPages, onChange, disabled = false }: PaginationProps) {
  const { t } = useI18n();
  const pages = pageWindow(currentPage, Math.max(1, totalPages));

  return (
    <nav className="flex items-center justify-center gap-1.5 py-6" aria-label={t('common.pagination')}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={disabled || currentPage <= 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800 rtl:rotate-180"
        style={{ borderColor: 'rgb(var(--border))' }}
        aria-label={t('common.previousPage')}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page, i) =>
        page === null ? (
          <span key={`gap-${i}`} className="inline-flex h-8 w-6 items-center justify-center text-sm text-slate-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onChange(page)}
            disabled={disabled}
            aria-current={page === currentPage ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-medium tabular-nums transition-all disabled:cursor-default',
              page === currentPage
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        disabled={disabled || currentPage >= totalPages}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800 rtl:rotate-180"
        style={{ borderColor: 'rgb(var(--border))' }}
        aria-label={t('common.nextPage')}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
