'use client';

import { Bike, DollarSign, Battery, Clock } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { WeeklyTripsChart } from '@/components/reports/WeeklyTripsChart';
import { BatteryDistributionChart } from '@/components/reports/BatteryDistributionChart';
import { MonthlyRevenueChart } from '@/components/reports/MonthlyRevenueChart';
import { CostAnalysisChart } from '@/components/reports/CostAnalysisChart';
import { TopDriversLeaderboard } from '@/components/reports/TopDriversLeaderboard';
import { useI18n } from '@/i18n/I18nProvider';

export default function ReportsPage() {
  const { t } = useI18n();

  return (
    <DashboardShell title={t('reports.title')} subtitle={t('reports.subtitle')}>
      {/* Top metrics — colorful gradient cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('reports.totalTripsToday')}
          value={234}
          trend={12}
          trendLabel={t('common.fromYesterday')}
          icon={<Bike className="h-5 w-5" />}
          iconColor="blue"
        />
        <MetricCard
          label={t('reports.dailyRevenue')}
          value="5,680"
          unit="SAR"
          trend={8}
          trendLabel={t('common.fromYesterday')}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="green"
        />
        <MetricCard
          label={t('reports.averageBattery')}
          value={67}
          unit="%"
          trend={-3}
          trendLabel={t('common.fromYesterday')}
          icon={<Battery className="h-5 w-5" />}
          iconColor="violet"
        />
        <MetricCard
          label={t('reports.avgTripTime')}
          value={24}
          unit={t('common.minutes')}
          trend={2}
          trendLabel={t('common.minutes')}
          icon={<Clock className="h-5 w-5" />}
          iconColor="orange"
        />
      </div>

      {/* Weekly Trips + Battery Distribution */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyTripsChart />
        <BatteryDistributionChart />
      </div>

      {/* Monthly Revenue full-width */}
      <div className="mt-5">
        <MonthlyRevenueChart />
      </div>

      {/* Cost Analysis + Top Drivers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CostAnalysisChart />
        <div className="lg:col-span-2">
          <TopDriversLeaderboard />
        </div>
      </div>
    </DashboardShell>
  );
}
