'use client';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';

interface TopDriver {
  name: string;
  swaps: number;
  charges: number;
  /** Total sessions (swaps + charges) — the ranking metric. */
  activity: number;
}

interface Props {
  data: TopDriver[];
  loading?: boolean;
}

const rankColors = [
  'bg-gradient-to-br from-blue-500 to-indigo-600',
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-amber-400 to-orange-500',
  'bg-gradient-to-br from-emerald-400 to-teal-500',
];

const barColors = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
];

export function TopDriversLeaderboard({ data, loading }: Props) {
  const { t, locale } = useI18n();

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('reports.topDriversLeaderboard')}
      </h3>

      {loading ? (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="mt-6 py-6 text-center text-sm text-slate-400">{t('common.noData')}</p>
      ) : (
        (() => {
          // Bar length is each driver's activity relative to the busiest driver.
          const maxActivity = Math.max(...data.map((d) => d.activity), 1);
          return (
            <ul className="mt-4 space-y-4">
              {data.map((driver, idx) => (
                <li key={`${driver.name}-${idx}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm',
                        rankColors[idx % rankColors.length],
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {driver.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {driver.swaps} {t('reports.swaps')} · {driver.charges} {t('reports.charges')}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {driver.activity}
                      </p>
                      <p className="text-[10px] text-slate-500">{t('reports.sessions')}</p>
                    </div>
                  </div>
                  <div className="mt-2 ms-10 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn('h-full rounded-full', barColors[idx % barColors.length])}
                      style={{ width: `${(driver.activity / maxActivity) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          );
        })()
      )}
    </Card>
  );
}
