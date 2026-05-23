'use client';

import { Clock, MapPin, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { FastChargingCabinet } from '@/types';

function CirclePercent({ value, error }: { value: number; error: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = error ? '#ef4444' : value >= 60 ? '#f59e0b' : value >= 30 ? '#3b82f6' : '#10b981';
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

interface Props { cabinet: FastChargingCabinet; onClick?: () => void; }

export function FastChargingCabinetCard({ cabinet, onClick }: Props) {
  const { t } = useI18n();
  const hasError = cabinet.status === 'error';
  const utilization = cabinet.totalPorts > 0
    ? Math.round((cabinet.chargingPorts / cabinet.totalPorts) * 100)
    : 0;

  return (
    <Card className={cn('relative cursor-pointer p-5 transition-all hover:shadow-card-hover',
      hasError && 'ring-1 ring-rose-200 dark:ring-rose-500/30'
    )} onClick={onClick}>
      {hasError && (
        <span className="absolute end-3 top-3 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          ERROR
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{cabinet.name}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{cabinet.district}, {cabinet.city}</span>
          </p>
        </div>
        <CirclePercent value={utilization} error={hasError} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{cabinet.availablePorts}</span>
          {t('fastCharging.available')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          <span className="font-bold text-sky-600 dark:text-sky-400">{cabinet.chargingPorts}</span>
          {t('fastCharging.charging')}
        </span>
        <span className={cn('inline-flex items-center gap-1.5', hasError ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')}>
          <span className={cn('h-2 w-2 rounded-full', hasError ? 'bg-rose-500' : 'bg-slate-300')} />
          <span className="font-bold">{cabinet.errorPorts}</span>
          {t('fastCharging.error')}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3"
        style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span className="font-bold text-slate-700 dark:text-slate-200">{cabinet.avgChargeTimeMinutes}</span>
          <span>{t('fastCharging.minsUnit')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Zap className="h-3 w-3" />
          <span className="font-bold text-slate-700 dark:text-slate-200">{cabinet.todaySessions}</span>
          <span>{t('fastCharging.todaySessions')}</span>
        </div>
      </div>
    </Card>
  );
}
