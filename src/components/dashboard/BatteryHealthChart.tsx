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
import { useI18n } from '@/i18n/I18nProvider';
import type { BatteryHealthPoint } from '@/types';

interface BatteryHealthChartProps {
  data: BatteryHealthPoint[];
}

export function BatteryHealthChart({ data }: BatteryHealthChartProps) {
  const { t } = useI18n();

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('dashboard.batteryHealthTrend')}
      </h3>

      <div className="mt-5 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              domain={[85, 100]}
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
              dataKey="health"
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2, stroke: '#4f46e5', fill: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
