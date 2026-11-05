'use client';

import { useState } from 'react';
import { Repeat, DollarSign, Battery, Cpu } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { WeeklySessionsChart } from '@/components/reports/WeeklySessionsChart';
import { BatteryDistributionChart } from '@/components/reports/BatteryDistributionChart';
import { MonthlyRevenueChart } from '@/components/reports/MonthlyRevenueChart';
import { CostAnalysisChart } from '@/components/reports/CostAnalysisChart';
import { TopDriversLeaderboard } from '@/components/reports/TopDriversLeaderboard';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { useFleetContext } from '@/hooks/useFleetContext';
import { useSection } from '@/hooks/useSection';
import { reportsApi, dashboardApi } from '@/lib/api';
import { isForbiddenError } from '@/lib/api-errors';
import { sumMoney } from '@/lib/money';

function KpiSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  );
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { tv } = useVehicleTerm();
  const { formatMoney } = useFleetContext();

  // Each part loads, and fails, on its own: one missing backend route (e.g.
  // reports/weekly-trips) degrades only its own card. The KPI cards used to
  // wait for /fleet-admin/dashboard, and stayed skeletons for good when it
  // failed — Sessions 7d and Revenue 7d included, which never needed it (FA-313).
  const metrics = useSection('[Reports] metrics',              () => dashboardApi.getMetrics());
  const weekly  = useSection('[Reports] weekly sessions',      () => reportsApi.getWeeklySessions());
  const monthly = useSection('[Reports] monthly revenue',      () => reportsApi.getMonthlyRevenue());
  const battery = useSection('[Reports] battery distribution', () => reportsApi.getBatteryDistribution());
  const cost    = useSection('[Reports] cost analysis',        () => reportsApi.getCostAnalysis());
  const top     = useSection('[Reports] top drivers',          () => reportsApi.getTopDrivers());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const sections: [{ error: unknown; loading: boolean }, string][] = [
    [metrics, t('reports.sectionMetrics')],
    [weekly,  t('reports.sectionWeeklySessions')],
    [monthly, t('reports.sectionMonthlyRevenue')],
    [battery, t('reports.sectionBatteryDistribution')],
    [cost,    t('reports.sectionCostAnalysis')],
    [top,     t('reports.sectionTopDrivers')],
  ];
  // Every section refused with a 403 is "no access", not six empty charts. A
  // single refused section is still just a failed section, listed below.
  const forbidden = sections.every(([s]) => s.error !== undefined && isForbiddenError(s.error));
  const failedSections = bannerDismissed
    ? []
    : sections.filter(([s]) => s.error !== undefined).map(([, label]) => label);

  const weeklySessions = weekly.data ?? [];

  if (forbidden) {
    return (
      <DashboardShell title={t('reports.title')} subtitle={tv('reports.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('reports.title')} subtitle={tv('reports.subtitle')}>
      {failedSections.length > 0 && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span>
            {t('reports.partialLoad')}{' '}
            <span className="font-semibold">{failedSections.join('، ')}</span>
          </span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 text-amber-400 hover:text-amber-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top metrics — each card waits on, and fails with, its own source:
          Sessions 7d and Revenue 7d on the weekly report, the other two on
          /fleet-admin/dashboard. A failed source reads "—", not a skeleton
          forever and not a 0 (FA-313). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {weekly.loading && !weekly.data ? (
          <><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <MetricCard
              label={t('reports.sessions7d')}
              value={weekly.data ? weekly.data.reduce((s, w) => s + w.sessions, 0) : '—'}
              icon={<Repeat className="h-5 w-5" />}
              iconColor="blue"
            />
            <MetricCard
              label={t('reports.revenue7d')}
              // Summed in integer minor units, formatted once (FA-317).
              value={weekly.data
                ? formatMoney(sumMoney(weekly.data.map((w) => w.revenueMoney)).amount, locale)
                : '—'}
              icon={<DollarSign className="h-5 w-5" />}
              iconColor="green"
            />
          </>
        )}
        {metrics.loading && !metrics.data ? (
          <><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <MetricCard
              label={t('reports.averageBattery')}
              value={metrics.data?.averageSoc ?? '—'}
              unit={metrics.data?.averageSoc !== undefined ? '%' : undefined}
              icon={<Battery className="h-5 w-5" />}
              iconColor="violet"
            />
            <MetricCard
              label={t('reports.onlineDevices')}
              value={metrics.data?.onlineDevices ?? '—'}
              icon={<Cpu className="h-5 w-5" />}
              iconColor="orange"
            />
          </>
        )}
      </div>

      {/* Weekly sessions + Battery Distribution */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklySessionsChart data={weeklySessions} loading={weekly.loading} />
        <BatteryDistributionChart data={battery.data ?? []} loading={battery.loading} />
      </div>

      {/* Monthly Revenue full-width */}
      <div className="mt-5">
        <MonthlyRevenueChart data={monthly.data ?? []} loading={monthly.loading} />
      </div>

      {/* Cost Analysis + Top Drivers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CostAnalysisChart data={cost.data ?? []} loading={cost.loading} />
        <div className="lg:col-span-2">
          <TopDriversLeaderboard data={top.data ?? []} loading={top.loading} />
        </div>
      </div>

    </DashboardShell>
  );
}
