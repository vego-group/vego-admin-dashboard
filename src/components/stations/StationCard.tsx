'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, MapPin, TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { BatteryStation } from '@/types';
import { cn } from '@/lib/cn';

interface StationCardProps {
  station: BatteryStation;
  onClick?: () => void;
}

function getAvailabilityTone(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 60) return 'success';
  if (percent >= 35) return 'warning';
  return 'danger';
}

export function StationCard({ station, onClick }: StationCardProps) {
  const { t } = useI18n();
  const availability = Math.round((station.available / station.totalCapacity) * 100);
  const tone = getAvailabilityTone(availability);

  // Stacked bar segments
  const total = station.totalCapacity || 1;
  const availPct = (station.available / total) * 100;
  const chargingPct = (station.charging / total) * 100;
  const inUsePct = (station.inUse / total) * 100;

  return (
    <Card
      className="cursor-pointer p-5 transition-all hover:shadow-card-hover"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
            {station.name}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{station.district}, {station.city}</span>
          </p>
        </div>
        <Badge tone={tone}>{availability}%</Badge>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('stations.available')}
          </span>
          <span className="font-bold tabular-nums text-emerald-600">{station.available}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            {t('stations.charging')}
          </span>
          <span className="font-bold tabular-nums text-sky-600">{station.charging}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            {t('stations.inUse')}
          </span>
          <span className="font-bold tabular-nums text-orange-600">{station.inUse}</span>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="bg-emerald-500" style={{ width: `${availPct}%` }} />
        <div className="bg-sky-500" style={{ width: `${chargingPct}%` }} />
        <div className="bg-orange-500" style={{ width: `${inUsePct}%` }} />
      </div>

      <div
        className="mt-4 flex items-center justify-between border-t pt-3"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{t('stations.avgWaitTime')}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {station.avgWaitTimeMinutes} {t('common.minutes')}
          </span>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-slate-800'
          )}
        >
          <TrendingUp className="h-3 w-3 text-slate-500" />
          <span className="text-slate-500">{t('common.today')}</span>
          <span className="text-slate-900 dark:text-slate-100">{station.todaySwaps}</span>
        </div>
      </div>
    </Card>
  );
}
