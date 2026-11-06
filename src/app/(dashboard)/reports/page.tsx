'use client';

import { Repeat, DollarSign, Battery, Cpu } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { SectionLoadError } from '@/components/ui/LoadError';
import { WeeklySessionsChart } from '@/components/reports/WeeklySessionsChart';
import { BatteryDistributionChart } from '@/components/reports/BatteryDistributionChart';
import { MonthlyRevenueChart } from '@/components/reports/MonthlyRevenueChart';
import { CostAnalysisChart } from '@/components/reports/CostAnalysisChart';
import { TopDriversLeaderboard } from '@/components/reports/TopDriversLeaderboard';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { useFleetContext } from '@/hooks/useFleetContext';
import { useSection, type Section } from '@/hooks/useSection';
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

  // Every section refused with a 403 is "no access", not six empty charts. A
  // single refused section is still just a failed section, shown in its card.
  const forbidden = [metrics, weekly, monthly, battery, cost, top]
    .every((s) => s.error !== undefined && isForbiddenError(s.error));

  // A failed chart says so in its own card, with Retry, instead of drawing an
  // empty chart under a page-wide list of what failed (FA-312).
  const failureOf = (s: Section<unknown>) =>
    s.error !== undefined ? <SectionLoadError section={s} /> : undefined;

  if (forbidden) {
    return (
      <DashboardShell title={t('reports.title')} subtitle={tv('reports.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('reports.title')} subtitle={tv('reports.subtitle')}>
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
      {/* The weekly report's failure is told in its chart below; the dashboard
          metrics have no card of their own, so theirs is told here. */}
      {!metrics.data && (
        <SectionLoadError className="mt-4" section={metrics} title={t('dashboard.metricsLoadFailed')} />
      )}

      {/* Weekly sessions + Battery Distribution */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklySessionsChart data={weekly.data ?? []} loading={weekly.loading} failure={failureOf(weekly)} />
        <BatteryDistributionChart data={battery.data ?? []} loading={battery.loading} failure={failureOf(battery)} />
      </div>

      {/* Monthly Revenue full-width */}
      <div className="mt-5">
        <MonthlyRevenueChart data={monthly.data ?? []} loading={monthly.loading} failure={failureOf(monthly)} />
      </div>

      {/* Cost Analysis + Top Drivers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CostAnalysisChart data={cost.data ?? []} loading={cost.loading} failure={failureOf(cost)} />
        <div className="lg:col-span-2">
          <TopDriversLeaderboard data={top.data ?? []} loading={top.loading} failure={failureOf(top)} />
        </div>
      </div>

    </DashboardShell>
  );
}
