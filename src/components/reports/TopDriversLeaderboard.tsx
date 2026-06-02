'use client';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

interface TopDriver {
  name: string;
  earnings: number;
  swaps: number;
  charges: number;
  dropOff: number;
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
      ) : (
        <ul className="mt-4 space-y-4">
          {data.map((driver, idx) => (
            <li key={driver.name}>
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
                    {formatCurrency(driver.earnings, locale)}
                  </p>
                </div>
              </div>
              <div className="mt-2 ms-10 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn('h-full rounded-full', barColors[idx % barColors.length])}
                    style={{ width: `${driver.dropOff}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium tabular-nums text-slate-500">
                  {driver.dropOff}% {t('reports.dropOff')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
