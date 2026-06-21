'use client';

import { useEffect, useState } from 'react';
import { Bike, BatteryCharging, TrendingUp, Clock } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveFleetMap } from '@/components/dashboard/LiveFleetMap';
import { FleetStatusPanel } from '@/components/dashboard/FleetStatusPanel';
import { TodaysUsageChart } from '@/components/dashboard/TodaysUsageChart';
import { BatteryHealthChart } from '@/components/dashboard/BatteryHealthChart';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { dashboardApi, fleetApi, stationsApi } from '@/lib/api';
import type {
  DashboardMetrics,
  UsagePoint,
  BatteryHealthPoint,
  Vehicle,
  BatteryStation,
} from '@/types';
import { logger } from '@/lib/logger';

// ── Safe initial state — all zeros, no fake numbers ─────────────────────────

const EMPTY_METRICS: DashboardMetrics = {
  activeFleet: 0,
  availableBatteries: 0,
  totalTripsToday: 0,
  avgTripDurationMinutes: 0,
  chargingBatteries: 0,
  averageSoc: 0,
  lowBatteryCount: 0,
  averageCostPerVehicle: 0,
  successRate: 0,
  fleetTrend: 0,
  batteriesTrend: 0,
  tripsTrend: 0,
  durationTrend: 0,
  totalDrivers: 0,
  activeTrips: 0,
  unresolvedAlarms: 0,
  onlineDevices: 0,
};

const FALLBACK_USAGE: UsagePoint[] = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  value: 0,
}));

const FALLBACK_HEALTH: BatteryHealthPoint[] = [
  { month: 'Jan', health: 0 }, { month: 'Feb', health: 0 }, { month: 'Mar', health: 0 },
  { month: 'Apr', health: 0 }, { month: 'May', health: 0 }, { month: 'Jun', health: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useI18n();

  // KPI + Fleet Status — starts with zeros, replaced by real API data
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Today's Usage chart
  const [usage, setUsage] = useState<UsagePoint[]>(FALLBACK_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);

  // Battery Health chart
  const [health, setHealth] = useState<BatteryHealthPoint[]>(FALLBACK_HEALTH);
  const [healthLoading, setHealthLoading] = useState(true);

  // Live Fleet Map — empty until API responds
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<BatteryStation[]>([]);

  useEffect(() => {
    let cancelled = false;

    // ── KPI + Fleet Status → GET /fleet-admin/dashboard ────────────────────
    dashboardApi.getMetrics()
      .then((data) => { if (!cancelled) setMetrics(data); })
      .catch((err) => logger.error('[Dashboard] metrics failed:', err))
      .finally(() => { if (!cancelled) setMetricsLoading(false); });

    // ── Today's Usage → GET /fleet-admin/dashboard/usage ───────────────────
    dashboardApi.getUsage()
      .then((data) => { if (!cancelled && data.length > 0) setUsage(data); })
      .catch((err) => logger.error('[Dashboard] usage failed:', err))
      .finally(() => { if (!cancelled) setUsageLoading(false); });

    // ── Battery Health → GET /fleet-admin/dashboard/battery-health?months=6 ─
    dashboardApi.getBatteryHealth()
      .then((data) => { if (!cancelled && data.length > 0) setHealth(data); })
      .catch((err) => logger.error('[Dashboard] battery-health failed:', err))
      .finally(() => { if (!cancelled) setHealthLoading(false); });

    // ── Live Fleet Map vehicles → GET /fleet-admin/motorcycles ─────────────
    fleetApi.list()
      .then((data) => { if (!cancelled) setVehicles(data); })
      .catch((err) => logger.error('[Dashboard] vehicles failed:', err));

    // ── Live Fleet Map stations → GET /fleet-admin/cabinets ────────────────
    stationsApi.list()
      .then((data) => { if (!cancelled) setStations(data); })
      .catch((err) => logger.error('[Dashboard] stations failed:', err));

    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : (
          <>
            <MetricCard
              label={t('dashboard.activeFleet')}
              value={metrics.activeFleet}
              trend={metrics.fleetTrend}
              trendLabel={t('common.fromYesterday')}
              icon={<Bike className="h-5 w-5" />}
              iconColor="indigo"
            />
            <MetricCard
              label={t('dashboard.availableBatteries')}
              value={metrics.availableBatteries}
              trend={metrics.batteriesTrend}
              trendLabel={t('dashboard.charged')}
              icon={<BatteryCharging className="h-5 w-5" />}
              iconColor="sky"
            />
            <MetricCard
              label={t('dashboard.totalTripsToday')}
              value={metrics.totalTripsToday}
              trend={metrics.tripsTrend}
              trendLabel={t('common.fromYesterday')}
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="green"
            />
            <MetricCard
              label={t('dashboard.avgTripDuration')}
              value={metrics.avgTripDurationMinutes}
              unit={t('common.minutes')}
              trend={metrics.durationTrend}
              trendLabel={t('common.minutes')}
              invertTrendColor
              icon={<Clock className="h-5 w-5" />}
              iconColor="violet"
            />
          </>
        )}
      </div>

      {/* ── Map + Fleet Status ──────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t('dashboard.liveFleetMap')}
            </h2>
            <p className="text-xs text-slate-500">{t('dashboard.liveFleetMapSubtitle')}</p>
          </div>
          <LiveFleetMap vehicles={vehicles} stations={stations} />
        </Card>

        {metricsLoading ? (
          <Skeleton className="min-h-[360px] rounded-2xl" />
        ) : (
          <FleetStatusPanel metrics={metrics} />
        )}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodaysUsageChart data={usage} loading={usageLoading} />
        <BatteryHealthChart data={health} loading={healthLoading} />
      </div>

    </DashboardShell>
  );
}
