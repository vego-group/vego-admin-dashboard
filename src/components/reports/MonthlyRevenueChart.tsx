'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useFleetContext } from '@/hooks/useFleetContext';
import type { RevenuePoint } from '@/types';

interface Props {
  data: RevenuePoint[];
  loading?: boolean;
}

export function MonthlyRevenueChart({ data, loading }: Props) {
  const { t, locale } = useI18n();
  const { formatMoney } = useFleetContext();

  // Ticks carry the currency at the fleet's full precision ("JOD 1,500.000"),
  // which recharts' default 60px axis clips. Size it from the widest label this
  // data produces — an estimate at the 11px tick font.
  const axisWidth = useMemo(() => {
    const max = data.reduce((m, p) => Math.max(m, p.revenue), 0);
    return Math.min(140, Math.max(60, formatMoney(max, locale).length * 7 + 8));
  }, [data, formatMoney, locale]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t('reports.monthlyRevenue')}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{t('reports.last4Months')}</p>
        </div>
        <span className="text-slate-400">
          <TrendingUp className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 h-[240px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={axisWidth}
                tickFormatter={(v: number) => formatMoney(v, locale)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
                formatter={(value) => [formatMoney(Number(value), locale), t('reports.revenue')]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4f46e5"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
