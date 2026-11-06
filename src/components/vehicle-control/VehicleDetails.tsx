'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { VehicleIconTile } from '@/components/ui/VehicleIconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Battery,
  MapPin,
  User,
  Gauge,
  ExternalLink,
  Repeat,
  Zap,
  BatteryCharging,
  Bell,
  Thermometer,
  Activity,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { cn } from '@/lib/cn';
import { formatBatteryLevel, formatNumber, formatRelativeTime } from '@/lib/format';
import { vehicleDisplayName } from '@/lib/vehicle-label';
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
  const { t, locale } = useI18n();
  const { tv } = useVehicleTerm();

  // The battery endpoint's reading when it has one, else the list's. Neither
  // is replaced by 0: a missing reading shows "—" and a grey bar (FA-207).
  const batteryLevel = battery?.level  ?? vehicle.batteryLevel;
  const rangeKm      = battery?.rangeKm ?? vehicle.estimatedRangeKm;
  const hasLevel     = batteryLevel !== undefined;
  const barWidth     = hasLevel ? Math.min(100, Math.max(0, batteryLevel)) : 0;

  const batteryColor =
    !hasLevel ? 'from-slate-300 to-slate-300'
    : batteryLevel > 50 ? 'from-emerald-400 to-emerald-500'
    : batteryLevel > 20 ? 'from-amber-400 to-amber-500'
    : 'from-rose-400 to-rose-500';

  const batteryIconBg =
    !hasLevel ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    : batteryLevel > 50 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
    : batteryLevel > 20 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
    : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400';

  /** A count or distance as reported, or "—" — never 0 / NaN for "not reported" (FA-206). */
  const shown = (value: number | undefined, unit?: string): string =>
    value === undefined ? '—' : unit ? `${formatNumber(value, locale)} ${unit}` : formatNumber(value, locale);
  const distanceKm = statistics?.totalDistanceKm ?? vehicle.totalDistanceKm;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VehicleIconTile status={vehicle.status} size="lg" />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                <span dir="ltr" className="whitespace-nowrap">{vehicleDisplayName(vehicle)}</span>
                {vehicle.plateNumber && (
                  <span className="ms-2 text-sm font-medium text-slate-400"><span dir="ltr">#{vehicle.id}</span></span>
                )}
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
              {formatBatteryLevel(batteryLevel)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t('vehicleControl.estRange')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {shown(rangeKm, t('common.kilometers'))}
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-all', batteryColor)}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Extra battery details from /battery endpoint */}
        {battery && (battery.sohPct != null || battery.voltage != null || battery.temperature != null) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {battery.sohPct != null && (
              <StatChip icon={<BatteryCharging className="h-3.5 w-3.5" />} label={t('vehicleControl.stateOfHealth')} value={`${formatNumber(battery.sohPct, locale)}%`} ltr />
            )}
            {battery.voltage != null && (
              <StatChip icon={<Activity className="h-3.5 w-3.5" />} label={t('vehicleControl.voltage')} value={`${formatNumber(battery.voltage, locale)} ${t('common.volts')}`} />
            )}
            {battery.temperature != null && (
              <StatChip icon={<Thermometer className="h-3.5 w-3.5" />} label={t('vehicleControl.temperature')} value={`${formatNumber(battery.temperature, locale)} ${t('common.celsius')}`} />
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
          // Sessions, not trips: the platform has no trips (FA-206).
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Repeat className="h-4 w-4" />}
              iconCls="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15"
              label={t('vehicleControl.statSwaps')}
              value={shown(statistics?.swaps)}
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              iconCls="bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15"
              label={t('vehicleControl.statCharges')}
              value={shown(statistics?.charges)}
            />
            <StatCard
              icon={<Bell className="h-4 w-4" />}
              iconCls="bg-rose-50 text-rose-500 dark:bg-rose-500/15"
              label={t('vehicleControl.statAlarms')}
              value={shown(statistics?.alarms)}
            />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              iconCls="bg-amber-50 text-amber-500 dark:bg-amber-500/15"
              label={t('vehicleControl.statDistance')}
              value={shown(distanceKm, t('common.kilometers'))}
            />
          </div>
        )}
      </Card>

      {/* Vehicle Information */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {tv('vehicleControl.vehicleInformation')}
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
                {vehicle.currentSpeedKmh === undefined ? '—' : `${vehicle.currentSpeedKmh} ${t('common.kmh')}`}
              </p>
            </div>
          </li>
        </ul>
      </Card>

      {/* Last known position. This was "Live Location" over a "Map View
          Placeholder", with a "Full Map" button that did nothing. Nothing on
          this page polls, so it shows what the vehicle last reported, and
          when (FA-223, FA-315). */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.lastKnownPosition')}
        </h3>
        {vehicle.coordinates ? (
          <a
            href={`https://www.google.com/maps?q=${vehicle.coordinates.lat},${vehicle.coordinates.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span dir="ltr" className="tabular-nums">
              {vehicle.coordinates.lat.toFixed(5)}, {vehicle.coordinates.lng.toFixed(5)}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-label={t('vehicleControl.openInMaps')} />
          </a>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('common.locationUnknown')}</p>
        )}
        {vehicle.lastSeenAt && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('vehicleControl.lastSeen', { time: formatRelativeTime(vehicle.lastSeenAt, locale) })}
          </p>
        )}
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
        {/* Wraps rather than truncating: "Charges" / "Total distance" were cut off. */}
        <p className="break-words text-[10px] uppercase leading-tight tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      </div>
    </div>
  );
}

function StatChip({
  icon, label, value, ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Keep the value left-to-right: "97%" would read "%97" in Arabic. */
  ltr?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
      style={{ borderColor: 'rgb(var(--border))' }}>
      <span className="text-slate-400">{icon}</span>
      {/* A number with a translated unit ("72.4 فولت") follows the page's
          direction; a percentage stays LTR. */}
      {label}: <span className="font-semibold" dir={ltr ? 'ltr' : undefined}>{value}</span>
    </span>
  );
}
