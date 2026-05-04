'use client';

import {
  Bike,
  BatteryCharging,
  Gauge,
  BatteryLow,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';
import type { DashboardMetrics } from '@/types';
import { cn } from '@/lib/cn';

interface StatusItem {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconColor: string;
}

interface FleetStatusPanelProps {
  metrics: DashboardMetrics;
}

export function FleetStatusPanel({ metrics }: FleetStatusPanelProps) {
  const { t } = useI18n();

  const items: StatusItem[] = [
    {
      icon: <Bike className="h-4 w-4" />,
      label: t('dashboard.activeFleet'),
      value: metrics.activeFleet,
      iconColor: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    },
    {
      icon: <BatteryCharging className="h-4 w-4" />,
      label: t('dashboard.chargingBattery'),
      value: metrics.chargingBatteries,
      iconColor: 'bg-gradient-to-br from-sky-400 to-blue-500',
    },
    {
      icon: <Gauge className="h-4 w-4" />,
      label: t('dashboard.averageSoc'),
      value: `${metrics.averageSoc}%`,
      iconColor: 'bg-gradient-to-br from-orange-400 to-amber-500',
    },
    {
      icon: <BatteryLow className="h-4 w-4" />,
      label: t('dashboard.lowBattery'),
      value: metrics.lowBatteryCount,
      iconColor: 'bg-gradient-to-br from-rose-500 to-red-500',
    },
    {
      icon: <Coins className="h-4 w-4" />,
      label: t('dashboard.averageCostVehicle'),
      value: metrics.averageCostPerVehicle,
      iconColor: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: t('dashboard.successRate'),
      value: `${metrics.successRate}%`,
      iconColor: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    },
  ];

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {t('dashboard.fleetStatus')}
      </h3>

      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                  item.iconColor
                )}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </p>
                <p className="text-[11px] text-slate-500">{t('common.lastUpdate')}</p>
              </div>
            </div>
            <span className="shrink-0 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
