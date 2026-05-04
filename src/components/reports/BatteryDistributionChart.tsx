'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import { PieChart as PieIcon } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { mockBatteryDistribution } from '@/lib/mock-data';

export function BatteryDistributionChart() {
  const { t } = useI18n();

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {t('reports.batteryStatus')}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{t('reports.currentDistribution')}</p>
        </div>
        <span className="text-slate-400">
          <PieIcon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-2 flex items-center gap-5">
        <div className="h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mockBatteryDistribution}
                dataKey="percentage"
                nameKey="range"
                innerRadius={0}
                outerRadius={80}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {mockBatteryDistribution.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 text-xs">
          {mockBatteryDistribution.map((item) => (
            <li key={item.range} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-600 dark:text-slate-300">{item.range}</span>
              <span className="ms-auto font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {item.percentage}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
