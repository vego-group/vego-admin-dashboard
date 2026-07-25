'use client';

import { useEffect, useState } from 'react';
import { Bike, DollarSign, Battery, Clock } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { WeeklyTripsChart } from '@/components/reports/WeeklyTripsChart';
import { BatteryDistributionChart } from '@/components/reports/BatteryDistributionChart';
import { MonthlyRevenueChart } from '@/components/reports/MonthlyRevenueChart';
import { CostAnalysisChart } from '@/components/reports/CostAnalysisChart';
import { TopDriversLeaderboard } from '@/components/reports/TopDriversLeaderboard';
import { useI18n } from '@/i18n/I18nProvider';
import { reportsApi, dashboardApi } from '@/lib/api';
import type {
  BatteryDistribution,
  CostBreakdown,
  DashboardMetrics,
  RevenuePoint,
} from '@/types';
import { logger } from '@/lib/logger';

type WeeklyTrip    = { day: string; trips: number; revenue: number };
type TopDriver     = { name: string; earnings: number; swaps: number; charges: number; dropOff: number };

export default function ReportsPage() {
  const { t } = useI18n();

  const [loading, setLoading]               = useState(true);
  const [metrics, setMetrics]               = useState<DashboardMetrics | null>(null);
  const [weeklyTrips, setWeeklyTrips]       = useState<WeeklyTrip[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<RevenuePoint[]>([]);
  const [batteryDist, setBatteryDist]       = useState<BatteryDistribution[]>([]);
  const [costAnalysis, setCostAnalysis]     = useState<CostBreakdown[]>([]);
  const [topDrivers, setTopDrivers]         = useState<TopDriver[]>([]);
  const [failedSections, setFailedSections] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Each report widget loads independently so one missing backend route
      // (e.g. reports/weekly-trips) degrades only its own card, not the page.
      const [mRes, wtRes, mrRes, bdRes, caRes, tdRes] = await Promise.allSettled([
        dashboardApi.getMetrics(),
        reportsApi.getWeeklyTrips(),
        reportsApi.getMonthlyRevenue(),
        reportsApi.getBatteryDistribution(),
        reportsApi.getCostAnalysis(),
        reportsApi.getTopDrivers(),
      ]);
      if (cancelled) return;

      if (mRes.status  === 'fulfilled') setMetrics(mRes.value);
      if (wtRes.status === 'fulfilled') setWeeklyTrips(wtRes.value);
      if (mrRes.status === 'fulfilled') setMonthlyRevenue(mrRes.value);
      if (bdRes.status === 'fulfilled') setBatteryDist(bdRes.value);
      if (caRes.status === 'fulfilled') setCostAnalysis(caRes.value);
      if (tdRes.status === 'fulfilled') setTopDrivers(tdRes.value);

      // Collect the label of every section whose endpoint failed, so the user
      // sees exactly what's unavailable instead of a single raw error string.
      const sections: [PromiseSettledResult<unknown>, string][] = [
        [mRes,  t('reports.sectionMetrics')],
        [wtRes, t('reports.sectionWeeklyTrips')],
        [mrRes, t('reports.sectionMonthlyRevenue')],
        [bdRes, t('reports.sectionBatteryDistribution')],
        [caRes, t('reports.sectionCostAnalysis')],
        [tdRes, t('reports.sectionTopDrivers')],
      ];
      const failed = sections.filter(([r]) => r.status === 'rejected').map(([, label]) => label);
      if (failed.length > 0) {
        logger.error('[Reports] Failed sections:', failed,
          sections.filter(([r]) => r.status === 'rejected').map(([r]) => (r as PromiseRejectedResult).reason));
        setFailedSections(failed);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [t]);

  return (
    <DashboardShell title={t('reports.title')} subtitle={t('reports.subtitle')}>
      {failedSections.length > 0 && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span>
            {t('reports.partialLoad')}{' '}
            <span className="font-semibold">{failedSections.join('، ')}</span>
          </span>
          <button
            type="button"
            onClick={() => setFailedSections([])}
            className="shrink-0 text-amber-400 hover:text-amber-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-3 h-3 w-32" />
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              label={t('reports.totalTripsToday')}
              value={metrics.totalTripsToday}
              trend={metrics.tripsTrend}
              trendLabel={t('common.fromYesterday')}
              icon={<Bike className="h-5 w-5" />}
              iconColor="blue"
            />
            <MetricCard
              label={t('reports.dailyRevenue')}
              value={metrics.averageCostPerVehicle * metrics.activeFleet}
              unit="SAR"
              icon={<DollarSign className="h-5 w-5" />}
              iconColor="green"
            />
            <MetricCard
              label={t('reports.averageBattery')}
              value={metrics.averageSoc}
              unit="%"
              icon={<Battery className="h-5 w-5" />}
              iconColor="violet"
            />
            <MetricCard
              label={t('reports.avgTripTime')}
              value={metrics.avgTripDurationMinutes}
              unit={t('common.minutes')}
              icon={<Clock className="h-5 w-5" />}
              iconColor="orange"
            />
          </>
        )}
      </div>

      {/* Weekly Trips + Battery Distribution */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyTripsChart data={weeklyTrips} loading={loading} />
        <BatteryDistributionChart data={batteryDist} loading={loading} />
      </div>

      {/* Monthly Revenue full-width */}
      <div className="mt-5">
        <MonthlyRevenueChart data={monthlyRevenue} loading={loading} />
      </div>

      {/* Cost Analysis + Top Drivers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CostAnalysisChart data={costAnalysis} loading={loading} />
        <div className="lg:col-span-2">
          <TopDriversLeaderboard data={topDrivers} loading={loading} />
        </div>
      </div>

    </DashboardShell>
  );
}
