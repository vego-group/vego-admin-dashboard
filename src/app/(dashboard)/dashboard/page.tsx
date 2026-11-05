'use client';

import { Bike, BatteryCharging, Users, Cpu } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveFleetMap } from '@/components/dashboard/LiveFleetMap';
import { FleetStatusPanel } from '@/components/dashboard/FleetStatusPanel';
import { TodaysUsageChart } from '@/components/dashboard/TodaysUsageChart';
import { BatteryHealthChart } from '@/components/dashboard/BatteryHealthChart';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { LoadError, SectionLoadError } from '@/components/ui/LoadError';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { useSection } from '@/hooks/useSection';
import { dashboardApi, fleetApi, stationsApi } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import type { BatteryHealthPoint } from '@/types';

const FALLBACK_HEALTH: BatteryHealthPoint[] = [
  { month: 'Jan', health: 0 }, { month: 'Feb', health: 0 }, { month: 'Mar', health: 0 },
  { month: 'Apr', health: 0 }, { month: 'May', health: 0 }, { month: 'Jun', health: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();

  // Each part loads, and fails, on its own, and a failure says so with a Retry.
  // Failures used to go to the log only, leaving the page on zero-filled
  // defaults that read as a fleet with nothing in it (FA-312).
  const metrics  = useSection('[Dashboard] metrics',        () => dashboardApi.getMetrics());
  const usage    = useSection('[Dashboard] usage',          () => dashboardApi.getUsage());
  const health   = useSection('[Dashboard] battery health', () => dashboardApi.getBatteryHealth());
  const vehicles = useSection('[Dashboard] vehicles',       () => fleetApi.list());
  const stations = useSection('[Dashboard] stations',       () => stationsApi.list());

  // The KPIs are this page's data — a 403 on them means the account may not see it.
  if (metrics.error !== undefined && isForbiddenError(metrics.error)) {
    return (
      <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  const m = metrics.data;
  const metricsPending = metrics.loading && !m;
  // The map draws whatever did load; what did not is said above it.
  const mapFailures = [vehicles, stations].filter((s) => s.error !== undefined);
  const mapFailureLines = Array.from(new Set(mapFailures.flatMap((s) => failureLines(s.error, t))));

  return (
    <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsPending ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </>
        ) : !m ? (
          <SectionLoadError
            section={metrics}
            title={t('dashboard.metricsLoadFailed')}
            className="sm:col-span-2 lg:col-span-4"
          />
        ) : (
          <>
            <MetricCard
              label={t('dashboard.activeFleet')}
              value={m.activeFleet}
              trend={m.fleetTrend}
              trendLabel={t('common.fromYesterday')}
              icon={<Bike className="h-5 w-5" />}
              iconColor="indigo"
            />
            <MetricCard
              label={t('dashboard.availableBatteries')}
              value={m.availableBatteries}
              trend={m.batteriesTrend}
              // Was "charged": the change is in available batteries, like its
              // siblings' day-on-day change (FA-320).
              trendLabel={t('common.fromYesterday')}
              icon={<BatteryCharging className="h-5 w-5" />}
              iconColor="sky"
            />
            <MetricCard
              label={t('dashboard.totalDrivers')}
              value={m.totalDrivers}
              trend={m.driversTrend}
              trendLabel={t('common.fromYesterday')}
              icon={<Users className="h-5 w-5" />}
              iconColor="green"
            />
            <MetricCard
              label={t('dashboard.onlineDevices')}
              value={m.onlineDevices}
              icon={<Cpu className="h-5 w-5" />}
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
            <p className="text-xs text-slate-500">{tv('dashboard.liveFleetMapSubtitle')}</p>
          </div>
          {mapFailures.length > 0 && (
            <LoadError
              className="mb-4"
              title={t('dashboard.mapLoadFailed')}
              lines={mapFailureLines}
              onRetry={() => mapFailures.forEach((s) => s.retry())}
              retrying={mapFailures.some((s) => s.loading)}
            />
          )}
          <LiveFleetMap vehicles={vehicles.data ?? []} stations={stations.data ?? []} />
        </Card>

        {metricsPending ? (
          <Skeleton className="min-h-[360px] rounded-2xl" />
        ) : (
          <FleetStatusPanel
            metrics={m}
            failure={!m ? <SectionLoadError section={metrics} title={t('dashboard.metricsLoadFailed')} /> : undefined}
          />
        )}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodaysUsageChart
          data={usage.data ?? []}
          loading={usage.loading}
          failure={usage.error !== undefined ? <SectionLoadError section={usage} /> : undefined}
        />
        <BatteryHealthChart
          data={health.data && health.data.length > 0 ? health.data : FALLBACK_HEALTH}
          loading={health.loading}
          failure={health.error !== undefined ? <SectionLoadError section={health} /> : undefined}
        />
      </div>

    </DashboardShell>
  );
}
