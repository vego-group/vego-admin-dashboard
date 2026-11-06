'use client';

import { Info } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber } from '@/lib/format';
import type { ListPage } from '@/lib/api';

/**
 * How many pages a server-paged list can be stepped through. When the server
 * sent no counts, a full page means there may be another one, so "Next" stays
 * available; a short page is the last.
 */
export function pageCount(list: Pick<ListPage<unknown>, 'page' | 'perPage' | 'lastPage' | 'rows'>): number {
  if (list.lastPage !== undefined) return Math.max(1, list.lastPage);
  return list.rows.length >= list.perPage ? list.page + 1 : list.page;
}

/**
 * Which rows of a server-paged list are on screen, so a list is never cut
 * short silently (FA-302, FA-306): "Showing 21–40 of 312", or, when the server
 * sent no total and the page is full, a note that there may be more.
 */
export function ListPageNote({ list }: { list: Pick<ListPage<unknown>, 'page' | 'perPage' | 'total' | 'rows'> }) {
  const { t, locale } = useI18n();
  const count = list.rows.length;
  if (count === 0) return null;

  const from = formatNumber((list.page - 1) * list.perPage + 1, locale);
  const to   = formatNumber((list.page - 1) * list.perPage + count, locale);

  if (list.total !== undefined) {
    return (
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
        {t('common.showingRange', { from, to, total: formatNumber(list.total, locale) })}
      </p>
    );
  }
  if (count < list.perPage) return null;
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-amber-700 dark:text-amber-300">
      <Info className="h-3.5 w-3.5 shrink-0" />
      {t('common.showingRangeNoTotal', { from, to })}
    </p>
  );
}
