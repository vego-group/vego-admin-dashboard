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
import { TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { mockMonthlyRevenue } from '@/lib/mock-data';

export function MonthlyRevenueChart() {
  const { t } = useI18n();

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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockMonthlyRevenue} margin={{ top: 10, right: 4, left: -10, bottom: 0 }}>
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
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
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
      </div>
    </Card>
  );
}
