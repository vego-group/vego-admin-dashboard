'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { BarChart3 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  data: { day: string; trips: number; revenue: number }[];
  loading?: boolean;
}

export function WeeklyTripsChart({ data, loading }: Props) {
  const { t } = useI18n();

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t('reports.weeklyTrips')}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{t('reports.last7Days')}</p>
        </div>
        <span className="text-slate-400">
          <BarChart3 className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 h-[240px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
                }}
              />
              <Line
                type="monotone"
                dataKey="trips"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, stroke: '#4f46e5', fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
