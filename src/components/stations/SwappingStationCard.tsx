'use client';

import { Clock, MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { SwappingStation } from '@/types';

function CirclePercent({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 60 ? '#10b981' : value >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg className="absolute -rotate-90" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4"
          stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4"
          stroke={color} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="z-10 text-[10px] font-bold text-slate-700 dark:text-slate-200">{value}%</span>
    </div>
  );
}

interface Props { station: SwappingStation; onClick?: () => void; }

export function SwappingStationCard({ station, onClick }: Props) {
  const { t } = useI18n();
  const availability = Math.round((station.readyBatteries / station.totalCapacity) * 100);
  const total = station.totalCapacity || 1;
  const readyPct  = (station.readyBatteries    / total) * 100;
  const chargPct  = (station.chargingBatteries / total) * 100;
  const emptyPct  = (station.emptySlots        / total) * 100;

  return (
    <Card className="cursor-pointer p-5 transition-all hover:shadow-card-hover" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{station.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{station.district}, {station.city}</span>
          </p>
        </div>
        <CirclePercent value={availability} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{station.readyBatteries}</span>
          {t('batterySwapping.ready')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          <span className="font-bold text-sky-600 dark:text-sky-400">{station.chargingBatteries}</span>
          {t('batterySwapping.charging')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span className="font-bold text-slate-600 dark:text-slate-400">{station.emptySlots}</span>
          {t('batterySwapping.empty')}
        </span>
      </div>

      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="bg-emerald-500 transition-all" style={{ width: `${readyPct}%` }} />
        <div className="bg-sky-500 transition-all"     style={{ width: `${chargPct}%` }} />
        <div className="bg-slate-300 dark:bg-slate-600 transition-all" style={{ width: `${emptyPct}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3"
        style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{t('batterySwapping.avgWait')}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{station.avgWaitTimeMinutes}M</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <RefreshCw className="h-3 w-3" />
          <span>{t('batterySwapping.todaySwaps')}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{station.todaySwaps}</span>
        </div>
      </div>
    </Card>
  );
}
