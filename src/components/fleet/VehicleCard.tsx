'use client';

import { Battery, User, UserPlus, UserCog } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BatteryBar } from '@/components/ui/BatteryBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { VehicleIconTile } from '@/components/ui/VehicleIconTile';
import { LocationLabel } from '@/components/ui/LocationLabel';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { Vehicle } from '@/types';

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick?: () => void;
  /** Opens the assign/change-driver flow for this vehicle. */
  onAssignDriver?: () => void;
}

export function VehicleCard({ vehicle, onClick, onAssignDriver }: VehicleCardProps) {
  const { t, locale } = useI18n();
  const isAssigned = !!vehicle.assignedDriverName;

  return (
    <Card
      className="cursor-pointer p-5 transition-all hover:shadow-card-hover"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <VehicleIconTile status={vehicle.status} size="md" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{vehicle.id}</h3>
            <p className="text-xs text-slate-500">{vehicle.model}</p>
          </div>
        </div>
        <StatusPill status={vehicle.status} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <Battery className="h-3.5 w-3.5" />
            {t('fleet.battery')}
          </span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {vehicle.batteryLevel}%
          </span>
        </div>
        <BatteryBar value={vehicle.batteryLevel} className="mt-1.5" />
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <LocationLabel
          coordinates={vehicle.coordinates}
          parts={[vehicle.location]}
          className="flex text-slate-600 dark:text-slate-400"
        />
        {vehicle.assignedDriverName && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{vehicle.assignedDriverName}</span>
          </div>
        )}
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[11px]"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <div>
          <p className="text-slate-500">{t('fleet.lastTrip')}</p>
          <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">
            {formatRelativeTime(vehicle.lastTripAt, locale)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-slate-500">{t('fleet.totalDistance')}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {formatNumber(vehicle.totalDistanceKm, locale)} {t('common.kilometers')}
          </p>
        </div>
      </div>

      {onAssignDriver && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAssignDriver();
          }}
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
        >
          {isAssigned ? <UserCog className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {isAssigned ? t('fleet.changeDriver') : t('fleet.assignDriverAction')}
        </button>
      )}
    </Card>
  );
}
