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
import { dashboardApi } from '@/lib/api';
import type {
  DashboardMetrics,
  UsagePoint,
  BatteryHealthPoint,
} from '@/types';

export default function DashboardPage() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [usage, setUsage] = useState<UsagePoint[]>([]);
  const [health, setHealth] = useState<BatteryHealthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, u, h] = await Promise.all([
          dashboardApi.getMetrics(),
          dashboardApi.getUsage(),
          dashboardApi.getBatteryHealth(),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setUsage(u);
          setHealth(h);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      {/* KPI cards */}
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

      {/* Map + status side by side */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t('dashboard.liveFleetMap')}
            </h2>
            <p className="text-xs text-slate-500">{t('dashboard.liveFleetMapSubtitle')}</p>
          </div>
          <LiveFleetMap />
        </Card>
        {loading || !metrics ? (
          <Card className="p-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="mt-3 h-14" />
            ))}
          </Card>
        ) : (
          <FleetStatusPanel metrics={metrics} />
        )}
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <Card className="p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-5 h-[220px] w-full" />
            </Card>
            <Card className="p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-5 h-[220px] w-full" />
            </Card>
          </>
        ) : (
          <>
            <TodaysUsageChart data={usage} />
            <BatteryHealthChart data={health} />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
