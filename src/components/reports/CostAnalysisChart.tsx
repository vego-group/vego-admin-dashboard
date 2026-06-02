'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/format';
import type { CostBreakdown } from '@/types';

interface Props {
  data: CostBreakdown[];
  loading?: boolean;
}

export function CostAnalysisChart({ data, loading }: Props) {
  const { t, locale } = useI18n();
  const total = data.reduce((sum, c) => sum + c.value, 0);

  const labelKey = (category: string) => {
    const lc = category.toLowerCase();
    if (lc.includes('swap')) return 'reports.batterySwaps';
    if (lc.includes('charg')) return 'reports.fastCharging';
    return 'reports.penalties';
  };

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('reports.costAnalysis')}
      </h3>

      {loading ? (
        <Skeleton className="mt-4 h-[220px] w-full" />
      ) : (
        <>
          <div className="relative mt-3 mx-auto h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {t('reports.total')}
              </span>
              <span className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(total, locale)}
              </span>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-xs">
            {data.map((item) => (
              <li key={item.category} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-300">{t(labelKey(item.category))}</span>
                <span className="ms-auto font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(item.value, locale)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
