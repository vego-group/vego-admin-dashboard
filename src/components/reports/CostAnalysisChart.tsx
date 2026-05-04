'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/format';
import { mockCostAnalysis } from '@/lib/mock-data';

export function CostAnalysisChart() {
  const { t, locale } = useI18n();
  const total = mockCostAnalysis.reduce((sum, c) => sum + c.value, 0);

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('reports.costAnalysis')}
      </h3>

      <div className="relative mt-3 mx-auto h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={mockCostAnalysis}
              dataKey="value"
              nameKey="category"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={3}
              stroke="none"
            >
              {mockCostAnalysis.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {t('reports.fastCharging')}
          </span>
          <span className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(856, locale)}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-xs">
        {mockCostAnalysis.map((item) => {
          const labelKey =
            item.category === 'Battery Swaps'
              ? 'reports.batterySwaps'
              : item.category === 'Fast Charging'
              ? 'reports.fastCharging'
              : 'reports.penalties';
          return (
            <li key={item.category} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-600 dark:text-slate-300">{t(labelKey)}</span>
              <span className="ms-auto font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(item.value, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
