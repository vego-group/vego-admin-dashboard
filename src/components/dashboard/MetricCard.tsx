'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber } from '@/lib/format';

type IconColor = 'indigo' | 'sky' | 'emerald' | 'violet' | 'orange' | 'blue' | 'green';

const iconColorMap: Record<IconColor, string> = {
  indigo: 'bg-gradient-to-br from-indigo-500 to-violet-600',
  sky: 'bg-gradient-to-br from-sky-400 to-blue-500',
  emerald: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  violet: 'bg-gradient-to-br from-violet-500 to-purple-600',
  orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
  blue: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  green: 'bg-gradient-to-br from-emerald-400 to-teal-500',
};

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number; // positive = up (good for most), negative = down
  trendLabel?: string;
  invertTrendColor?: boolean; // for "duration", down is good
  icon: React.ReactNode;
  iconColor?: IconColor;
  unit?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  trendLabel,
  invertTrendColor,
  icon,
  iconColor = 'indigo',
  unit,
  className,
}: MetricCardProps) {
  const { locale } = useI18n();
  const numericValue = typeof value === 'number' ? formatNumber(value, locale) : value;

  let trendIsPositive: boolean | null = null;
  if (trend !== undefined) {
    const positive = trend >= 0;
    trendIsPositive = invertTrendColor ? !positive : positive;
  }

  return (
    <Card className={cn('relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
              {numericValue}
            </span>
            {unit && (
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>
            )}
          </div>
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
            iconColorMap[iconColor]
          )}
        >
          {icon}
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          {trendIsPositive ? (
            <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-rose-600" />
          )}
          <span className={cn(trendIsPositive ? 'text-emerald-600' : 'text-rose-600')}>
            {trend > 0 ? '+' : ''}
            {trend}
            {invertTrendColor ? '' : '%'}
          </span>
          {trendLabel && (
            <span className="text-slate-500 dark:text-slate-400">{trendLabel}</span>
          )}
        </div>
      )}
    </Card>
  );
}
