'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { VehicleIconTile } from '@/components/ui/VehicleIconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Battery,
  MapPin,
  Navigation,
  User,
  Maximize2,
  Gauge,
  Route,
  BatteryCharging,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Vehicle } from '@/types';
import type { MotorcycleBattery, MotorcycleStatistics } from '@/lib/api';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  battery?: MotorcycleBattery | null;
  statistics?: MotorcycleStatistics | null;
  loadingExtra?: boolean;
}

export function VehicleDetails({
  vehicle,
  battery,
  statistics,
  loadingExtra,
}: VehicleDetailsProps) {
  const { t } = useI18n();

  // Use real battery from dedicated endpoint if available, else fallback to list data
  const batteryLevel = battery?.level  ?? vehicle.batteryLevel;
  const rangeKm      = battery?.rangeKm ?? vehicle.estimatedRangeKm;

  const batteryColor =
    batteryLevel > 50 ? 'from-emerald-400 to-emerald-500'
    : batteryLevel > 20 ? 'from-amber-400 to-amber-500'
    : 'from-rose-400 to-rose-500';

  const batteryIconBg =
    batteryLevel > 50 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
    : batteryLevel > 20 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
    : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400';

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VehicleIconTile status={vehicle.status} size="lg" />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                #{vehicle.id} — {vehicle.plateNumber}
              </h2>
              <p className="text-sm text-slate-500">{vehicle.model}</p>
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
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', batteryIconBg)}>
            <Battery className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('vehicleControl.currentLevel')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {batteryLevel}%
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('vehicleControl.estRange')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {rangeKm} km
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all', batteryColor)}
            style={{ width: `${batteryLevel}%` }}
          />
        </div>

        {/* Extra battery details from /battery endpoint */}
        {battery && (battery.sohPct != null || battery.voltage != null || battery.temperature != null) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {battery.sohPct != null && (
              <StatChip icon={<BatteryCharging className="h-3.5 w-3.5" />} label="SoH" value={`${battery.sohPct}%`} />
            )}
            {battery.voltage != null && (
              <StatChip icon={<RefreshCw className="h-3.5 w-3.5" />} label="Voltage" value={`${battery.voltage}V`} />
            )}
            {battery.temperature != null && (
              <StatChip icon={<RefreshCw className="h-3.5 w-3.5" />} label="Temp" value={`${battery.temperature}°C`} />
            )}
          </div>
        )}
      </Card>

      {/* Statistics */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.statistics')}
        </h3>
        {loadingExtra ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Route className="h-4 w-4" />}
              iconCls="bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15"
              label={t('vehicleControl.statTrips')}
              value={statistics?.trips ?? vehicle.totalDistanceKm > 0 ? (statistics?.trips ?? '—') : '—'}
            />
            <StatCard
              icon={<BatteryCharging className="h-4 w-4" />}
              iconCls="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15"
              label={t('vehicleControl.statSwaps')}
              value={statistics?.swaps ?? '—'}
            />
            <StatCard
              icon={<Bell className="h-4 w-4" />}
              iconCls="bg-rose-50 text-rose-500 dark:bg-rose-500/15"
              label={t('vehicleControl.statAlarms')}
              value={statistics?.alarms ?? '—'}
            />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              iconCls="bg-amber-50 text-amber-500 dark:bg-amber-500/15"
              label={t('vehicleControl.statDistance')}
              value={statistics != null ? `${statistics.totalDistanceKm} km` : (vehicle.totalDistanceKm > 0 ? `${vehicle.totalDistanceKm} km` : '—')}
            />
          </div>
        )}
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
                {vehicle.location || '—'}
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

// ── Internal helpers ─────────────────────────────────────────────────────────

function StatCard({
  icon, iconCls, label, value,
}: {
  icon: React.ReactNode;
  iconCls: string;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconCls)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      </div>
    </div>
  );
}

function StatChip({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
      style={{ borderColor: 'rgb(var(--border))' }}>
      <span className="text-slate-400">{icon}</span>
      {label}: <span className="font-semibold">{value}</span>
    </span>
  );
}
