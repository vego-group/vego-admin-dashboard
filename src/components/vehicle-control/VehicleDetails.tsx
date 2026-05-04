'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { VehicleIconTile } from '@/components/ui/VehicleIconTile';
import {
  Battery,
  MapPin,
  Navigation,
  User,
  Maximize2,
  Gauge,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { Vehicle } from '@/types';

interface VehicleDetailsProps {
  vehicle: Vehicle;
}

export function VehicleDetails({ vehicle }: VehicleDetailsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VehicleIconTile status={vehicle.status} size="lg" />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Vego #{vehicle.id.replace('M', '203')}-01
              </h2>
              <p className="text-sm text-slate-500">Vego 2030</p>
            </div>
          </div>
          <Badge tone={vehicle.status === 'active' ? 'success' : 'neutral'} dot>
            {t(`status.${vehicle.status}`)}
          </Badge>
        </div>
      </Card>

      {/* Battery Status */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.batteryStatus')}
        </h3>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Battery className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('vehicleControl.currentLevel')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {vehicle.batteryLevel}%
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('vehicleControl.estRange')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {vehicle.estimatedRangeKm} km
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
            style={{ width: `${vehicle.batteryLevel}%` }}
          />
        </div>
      </Card>

      {/* Vehicle Information */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.vehicleInformation')}
        </h3>

        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <MapPin className="h-4 w-4 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {t('vehicleControl.location')}
              </p>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {vehicle.location}
              </p>
            </div>
          </li>
          {vehicle.assignedDriverName && (
            <li className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-violet-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {t('vehicleControl.assignedDriver')}
                </p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {vehicle.assignedDriverName}
                </p>
              </div>
            </li>
          )}
          <li className="flex items-center gap-3">
            <Gauge className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {t('vehicleControl.currentSpeed')}
              </p>
              <p className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {vehicle.currentSpeedKmh} km/h
              </p>
            </div>
          </li>
        </ul>
      </Card>

      {/* Live Location */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t('vehicleControl.liveLocation')}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {t('vehicleControl.fullMap')}
          </button>
        </div>

        <div className="relative mt-3 flex h-[140px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          <div className="text-center text-slate-400">
            <Navigation className="mx-auto h-6 w-6" />
            <p className="mt-1.5 text-xs font-medium">{t('vehicleControl.mapPlaceholder')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
