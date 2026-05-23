'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useI18n } from '@/i18n/I18nProvider';
import { swappingApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { SwappingStation } from '@/types';

type ViewMode = 'map' | 'card';
type FilterTab = 'all' | 'available' | 'charging' | 'empty';

const EFFICIENCY_DATA = [
  { day: 'Mon', pct: 45 },
  { day: 'Tue', pct: 55 },
  { day: 'Wed', pct: 73 },
  { day: 'Thu', pct: 92 },
  { day: 'Fri', pct: 68 },
  { day: 'Sat', pct: 52 },
  { day: 'Sun', pct: 38 },
];

type SwapEventType = 'success' | 'critical';
const RECENT_SWAPS: {
  id: string;
  label: string;
  station: string;
  change: string;
  time: string;
  type: SwapEventType;
}[] = [
  { id: '#882', label: 'Driver #882', station: 'King Fahd Cabinet', change: '+98%',    time: '2m ago',  type: 'success'  },
  { id: '#411', label: 'Driver #411', station: 'Olaya Cabinet B',   change: '+100%',   time: '15m ago', type: 'success'  },
  { id: '#12',  label: 'Cabinet #12', station: 'Offline Alert',     change: 'CRITICAL', time: '1h ago',  type: 'critical' },
];

export default function BatterySwappingPage() {
  const { t } = useI18n();
  const [stations, setStations] = useState<SwappingStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await swappingApi.list();
      if (!cancelled) {
        setStations(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const tabCounts = useMemo(() => ({
    all:       stations.length,
    available: stations.filter((s) => s.readyBatteries > 0).length,
    charging:  stations.filter((s) => s.chargingBatteries > 0).length,
    empty:     stations.filter((s) => s.emptySlots > 0).length,
  }), [stations]);

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all',       label: `${t('batterySwapping.all')} (${tabCounts.all})` },
    { value: 'available', label: `${t('batterySwapping.available')} (${tabCounts.available})` },
    { value: 'charging',  label: `${t('batterySwapping.charging')} (${tabCounts.charging})` },
    { value: 'empty',     label: `${t('batterySwapping.empty')} (${tabCounts.empty})` },
  ];

  const maxEfficiency = Math.max(...EFFICIENCY_DATA.map((d) => d.pct));

  return (
    <DashboardShell title={t('batterySwapping.title')} subtitle={t('batterySwapping.subtitle')}>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label={t('batterySwapping.readyBatteries')} value={totals.ready}    icon={<Battery className="h-5 w-5" />}        iconColor="green"   />
        <MetricCard label={t('batterySwapping.charging')}       value={totals.charging} icon={<BatteryCharging className="h-5 w-5" />} iconColor="sky"     />
        <MetricCard label={t('batterySwapping.emptySlots')}     value={totals.empty}    icon={<Battery className="h-5 w-5" />}        iconColor="orange"  />
        <MetricCard label={t('batterySwapping.totalCapacity')}  value={totals.capacity} icon={<LayoutGrid className="h-5 w-5" />}     iconColor="violet"  unit={`${stations.length} ${t('batterySwapping.cabinets')}`} />
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
          <div className="flex items-center gap-2">
            <div className="w-[200px]">
              <Input
                placeholder={t('batterySwapping.searchCabinets')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
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
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('batterySwapping.sync')}
            </button>
          </div>
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
        ) : view === 'map' ? (
          <>
            {/* Map */}
            <SwappingStationMap stations={filtered} height={420} />

            {/* Bottom two-column section */}
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
              {/* Efficiency Overview */}
              <Card className="p-5 lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {t('batterySwapping.efficiencyOverview')}
                  </h3>
                  <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <option>{t('batterySwapping.lastSevenDays')}</option>
                  </select>
                </div>

                {/* Bar chart */}
                <div className="flex h-36 items-end gap-2">
                  {EFFICIENCY_DATA.map((d) => {
                    const isPeak = d.pct === maxEfficiency;
                    const heightPct = (d.pct / 100) * 100;
                    return (
                      <div key={d.day} className="group relative flex flex-1 flex-col items-center gap-1">
                        {isPeak && (
                          <span className="absolute -top-5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            {d.pct}%
                          </span>
                        )}
                        <div className="relative w-full rounded-t-md transition-all" style={{ height: `${heightPct}%` }}>
                          <div
                            className={cn(
                              'h-full w-full rounded-t-md',
                              isPeak ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-brand-300 dark:group-hover:bg-brand-700'
                            )}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Recent Swaps */}
              <Card className="p-5 lg:col-span-2">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t('batterySwapping.recentSwaps')}
                </h3>
                <div className="space-y-3">
                  {RECENT_SWAPS.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          item.type === 'success'
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        {item.type === 'success'
                          ? <RefreshCw className="h-3.5 w-3.5" />
                          : <AlertTriangle className="h-3.5 w-3.5" />
                        }
                      </div>

                      {/* Labels */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                          {item.label}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{item.station}</p>
                      </div>

                      {/* Badge + time */}
                      <div className="flex flex-col items-end gap-0.5">
                        {item.type === 'critical' ? (
                          <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {item.change}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {item.change}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s) => (
                <SwappingStationCard key={s.id} station={s} />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(filtered.length / 6))}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
