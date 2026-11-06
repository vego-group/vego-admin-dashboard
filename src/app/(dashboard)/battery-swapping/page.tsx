'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle, Battery, BatteryCharging, LayoutGrid,
  Map as MapIcon, RefreshCw, Search,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { SwappingStationMap } from '@/components/stations/SwappingStationMap';
import { SwappingStationCard } from '@/components/stations/SwappingStationCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { LoadError } from '@/components/ui/LoadError';
import { useI18n } from '@/i18n/I18nProvider';
import { swappingApi, type SwapActivity } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { SwappingStation } from '@/types';
import { logger } from '@/lib/logger';

type ViewMode = 'map' | 'card';
type FilterTab = 'all' | 'available' | 'charging' | 'empty';
const PAGE_SIZE = 9;



export default function BatterySwappingPage() {
  const { t, locale } = useI18n();
  const [stations, setStations] = useState<SwappingStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [recentActivity, setRecentActivity] = useState<SwapActivity[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  // Why the last load of each part failed (FA-312). Both used to be dropped
  // without a word: a failed cabinets load read as a network with no cabinets
  // and every KPI at 0, a failed activity load as "No recent activity".
  const [stationsError, setStationsError] = useState<unknown>(undefined);
  const [activityError, setActivityError] = useState<unknown>(undefined);
  /** The cabinets have loaded at least once; until then the counts are unknown. */
  const [stationsLoaded, setStationsLoaded] = useState(false);

  const loadData = useCallback(async () => {
    setIsSyncing(true);
    const [stationsData, activityData] = await Promise.allSettled([
      swappingApi.list(),
      swappingApi.recentActivity(10),
    ]);
    if (stationsData.status === 'fulfilled') {
      setStations(stationsData.value);
      setStationsLoaded(true);
      setStationsError(undefined);
    } else {
      logger.error('[BatterySwapping] Failed to load cabinets:', stationsData.reason);
      setStationsError(stationsData.reason);
    }
    if (activityData.status === 'fulfilled') {
      setRecentActivity(activityData.value);
      setActivityError(undefined);
    } else {
      logger.error('[BatterySwapping] Failed to load recent activity:', activityData.reason);
      setActivityError(activityData.reason);
    }
    // The cabinets are this page's data; a 403 on them is "no access", not "no stations".
    setForbidden(stationsData.status === 'rejected' && isForbiddenError(stationsData.reason));
    setIsSyncing(false);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totals = useMemo(() => ({
    ready:    stations.reduce((s, x) => s + x.readyBatteries,    0),
    charging: stations.reduce((s, x) => s + x.chargingBatteries, 0),
    empty:    stations.reduce((s, x) => s + x.emptySlots,        0),
    capacity: stations.reduce((s, x) => s + x.totalCapacity,     0),
  }), [stations]);

  const filtered = useMemo(() => {
    let result = stations;
    if (tab === 'available') result = result.filter((s) => s.readyBatteries > 0);
    if (tab === 'charging')  result = result.filter((s) => s.chargingBatteries > 0);
    if (tab === 'empty')     result = result.filter((s) => s.emptySlots > 0);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.cabinetId.toLowerCase().includes(q) || s.district.toLowerCase().includes(q)
      );
    }
    return result;
  }, [stations, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabCounts = useMemo(() => ({
    all:       stations.length,
    available: stations.filter((s) => s.readyBatteries > 0).length,
    charging:  stations.filter((s) => s.chargingBatteries > 0).length,
    empty:     stations.filter((s) => s.emptySlots > 0).length,
  }), [stations]);

  // Counts only once the cabinets have loaded: "(0)" after a failure is a claim.
  const counted = (label: string, n: number) => (stationsLoaded ? `${label} (${n})` : label);
  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all',       label: counted(t('batterySwapping.all'),       tabCounts.all) },
    { value: 'available', label: counted(t('batterySwapping.available'), tabCounts.available) },
    { value: 'charging',  label: counted(t('batterySwapping.charging'),  tabCounts.charging) },
    { value: 'empty',     label: counted(t('batterySwapping.empty'),     tabCounts.empty) },
  ];
  /** A KPI: the count once the cabinets have loaded, "—" until then. */
  const kpi = (n: number) => (stationsLoaded ? n : '—');

  if (forbidden) {
    return (
      <DashboardShell title={t('batterySwapping.title')} subtitle={t('batterySwapping.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('batterySwapping.title')} subtitle={t('batterySwapping.subtitle')}>
      {/* A failed load says so. After an earlier success the last cabinets
          stay on screen below it, as last loaded. */}
      {stationsError !== undefined && (
        <LoadError
          className="mb-4"
          title={t('batterySwapping.loadFailed')}
          lines={failureLines(stationsError, t)}
          onRetry={() => { void loadData(); }}
          retrying={isSyncing}
        />
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label={t('batterySwapping.readyBatteries')} value={kpi(totals.ready)}    icon={<Battery className="h-5 w-5" />}        iconColor="green"   />
        <MetricCard label={t('batterySwapping.charging')}       value={kpi(totals.charging)} icon={<BatteryCharging className="h-5 w-5" />} iconColor="sky"     />
        <MetricCard label={t('batterySwapping.emptySlots')}     value={kpi(totals.empty)}    icon={<Battery className="h-5 w-5" />}        iconColor="orange"  />
        <MetricCard label={t('batterySwapping.totalCapacity')}  value={kpi(totals.capacity)} icon={<LayoutGrid className="h-5 w-5" />}     iconColor="violet"  unit={stationsLoaded ? `${stations.length} ${t('batterySwapping.cabinets')}` : undefined} />
      </div>

      {/* Toolbar */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t('batterySwapping.cabinetLocations')}
            </h2>
            <p className="text-xs text-slate-500">{t('batterySwapping.realtimeMap')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              variant="panel"
              value={view}
              onChange={(v) => setView(v)}
              options={[
                { value: 'map',  label: t('common.map'),  icon: <MapIcon    className="h-3.5 w-3.5" /> },
                { value: 'card', label: t('common.card'), icon: <LayoutGrid className="h-3.5 w-3.5" /> },
              ]}
            />
            <button
              type="button"
              onClick={loadData}
              disabled={isSyncing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              {t('batterySwapping.sync')}
            </button>
          </div>
        </div>
        {/* Search — full width below toolbar */}
        <div className="mt-3">
          <Input
            placeholder={t('batterySwapping.searchCabinets')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Filter tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TABS.map((tab_) => (
            <button
              key={tab_.value}
              type="button"
              onClick={() => { setTab(tab_.value); setPage(1); }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                tab === tab_.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/50'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              {tab_.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </Card>
        ) : !stationsLoaded ? null : view === 'map' ? (
          <>
            {/* Map */}
            <SwappingStationMap stations={filtered} height={420} />

            {/* Recent Swaps */}
            <div className="mt-5">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t('batterySwapping.recentSwaps')}
                </h3>
                {activityError !== undefined ? (
                  <LoadError
                    title={t('common.sectionLoadFailed')}
                    lines={failureLines(activityError, t)}
                    onRetry={() => { void loadData(); }}
                    retrying={isSyncing}
                  />
                ) : recentActivity.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">
                    {t('batterySwapping.noRecentActivity')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            item.type === 'swap'
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          )}
                        >
                          {item.type === 'swap'
                            ? <RefreshCw className="h-3.5 w-3.5" />
                            : <AlertTriangle className="h-3.5 w-3.5" />
                          }
                        </div>

                        {/* Labels */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                            {item.driverName ?? item.cabinetName}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {item.type === 'swap' ? item.cabinetName : (item.alertType ?? item.cabinetName)}
                          </p>
                        </div>

                        {/* Badge + time */}
                        <div className="flex flex-col items-end gap-0.5">
                          {item.type === 'alert' ? (
                            <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              {item.alertType ?? 'alert'}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              +{item.batteryChangePct ?? 0}%
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatRelativeTime(item.occurredAt, locale)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginated.map((s) => (
                <SwappingStationCard key={s.id} station={s} />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
