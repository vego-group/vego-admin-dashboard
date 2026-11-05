'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
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
  /** positive = up (good for most), negative = down. Undefined: no trend line at all. */
  trend?: number;
  trendLabel?: string;
  invertTrendColor?: boolean; // for "duration", down is good
  icon: React.ReactNode;
  iconColor?: IconColor;
  unit?: string;
  /** A short line under the value, e.g. to say a number needs no action. */
  hint?: string;
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
  hint,
  className,
}: MetricCardProps) {
  const { locale } = useI18n();
  const numericValue = typeof value === 'number' ? formatNumber(value, locale) : value;

  // The trend by its sign: up "+12%", down "−12%", flat "0%" in grey. A flat
  // trend used to get a green up-arrow, and an absent one arrived as 0 (FA-320).
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const up   = hasTrend && trend > 0;
  const down = hasTrend && trend < 0;
  const good = invertTrendColor ? down : up;
  const bad  = invertTrendColor ? up : down;
  const trendTone = good ? 'text-emerald-600' : bad ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400';
  const TrendIcon = up ? ArrowUp : down ? ArrowDown : Minus;

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
          {hint && (
            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p>
          )}
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

      {hasTrend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <TrendIcon className={cn('h-3.5 w-3.5', trendTone)} />
          <span className={trendTone} dir="ltr">
            {up ? '+' : down ? '−' : ''}
            {formatNumber(Math.abs(trend), locale)}
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
