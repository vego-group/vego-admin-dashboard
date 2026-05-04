'use client';

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
import { useI18n } from '@/i18n/I18nProvider';
import type { UsagePoint } from '@/types';

interface TodaysUsageChartProps {
  data: UsagePoint[];
}

export function TodaysUsageChart({ data }: TodaysUsageChartProps) {
  const { t } = useI18n();

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('dashboard.todaysUsage')}
      </h3>

      <div className="mt-5 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              domain={[0, 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#usageGradient)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
