'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap, AlertTriangle, LayoutGrid, Map as MapIcon, Search, Server } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveFleetMap } from '@/components/dashboard/LiveFleetMap';
import { FastChargingCabinetCard } from '@/components/stations/FastChargingCabinetCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { fastChargingApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { FastChargingCabinet, BatteryStation, FastChargingStatus } from '@/types';
import { logger } from '@/lib/logger';

type ViewMode = 'map' | 'card';
type FilterTab = 'all' | 'available' | 'charging' | 'error';
const PAGE_SIZE = 9; // 3-column grid — fills rows evenly


export default function FastChargingPage() {
  const { t } = useI18n();
  const [cabinets, setCabinets] = useState<FastChargingCabinet[]>([]);
  const [mapStations, setMapStations] = useState<BatteryStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fcData = await fastChargingApi.list();
        if (!cancelled) {
          setCabinets(fcData);
          // Convert piles → BatteryStation shape for the map
          setMapStations(fcData.map((c) => ({
            id:                 c.id,
            name:               c.name,
            district:           c.district,
            city:               c.city,
            coordinates:        c.coordinates,
            available:          c.availablePorts,
            charging:           c.chargingPorts,
            inUse:              c.chargingPorts,
            totalCapacity:      c.totalPorts,
            avgWaitTimeMinutes: c.avgChargeTimeMinutes,
            todaySwaps:         c.todaySessions,
            type:               'fast_charge' as const,
          })));
        }
      } catch (err) {
        logger.error('[FastCharging] Failed to load data:', err);
        setApiError(err instanceof Error ? err.message : 'Failed to load fast charging data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => ({
    available: cabinets.reduce((s, x) => s + x.availablePorts, 0),
    charging:  cabinets.reduce((s, x) => s + x.chargingPorts,  0),
    error:     cabinets.reduce((s, x) => s + x.errorPorts,     0),
    total:     cabinets.reduce((s, x) => s + x.totalPorts,     0),
  }), [cabinets]);

  const filtered = useMemo(() => {
    let result = cabinets;
    if (tab === 'available') result = result.filter((c) => c.availablePorts > 0);
    if (tab === 'charging')  result = result.filter((c) => c.chargingPorts  > 0);
    if (tab === 'error')     result = result.filter((c) => c.status === 'error');
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.cabinetId.toLowerCase().includes(q));
    }
    return result;
  }, [cabinets, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusLabel = (s: FastChargingStatus) =>
    s === 'operational' ? t('fastCharging.operational')
    : s === 'high_demand' ? t('fastCharging.highDemand')
    : t('fastCharging.error');

  const statusColor = (s: FastChargingStatus) =>
    s === 'error' ? 'text-rose-600 dark:text-rose-400'
    : s === 'high_demand' ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all',       label: `${t('fastCharging.all')} (${totals.total})` },
    { value: 'available', label: `${t('fastCharging.available')} (${totals.available})` },
    { value: 'charging',  label: `${t('fastCharging.charging')} (${totals.charging})` },
    { value: 'error',     label: `${t('fastCharging.error')} (${totals.error})` },
  ];

  return (
    <DashboardShell title={t('fastCharging.title')} subtitle={t('fastCharging.subtitle')}>
      {apiError && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{apiError}</span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="ms-3 shrink-0 text-rose-400 hover:text-rose-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label={t('fastCharging.availablePorts')} value={totals.available} icon={<Zap className="h-5 w-5" />}           iconColor="green"  />
        <MetricCard label={t('fastCharging.charging')}       value={totals.charging}  icon={<Zap className="h-5 w-5" />}           iconColor="sky"    />
        <MetricCard label={t('fastCharging.error')}          value={totals.error}     icon={<AlertTriangle className="h-5 w-5" />} iconColor="orange" />
        <MetricCard label={t('fastCharging.totalPorts')}     value={totals.total}     icon={<Server className="h-5 w-5" />}        iconColor="indigo" unit={`${cabinets.length} cabinets`} />
      </div>

      {/* Toolbar */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((tab_) => (
              <button
                key={tab_.value}
                type="button"
                onClick={() => { setTab(tab_.value); setPage(1); }}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                  tab === tab_.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/50'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {tab_.label}
              </button>
            ))}
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
        </div>

        {view === 'card' && (
          <div className="mt-4">
            <Input
              placeholder={t('common.searchByName')}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        )}
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </Card>
        ) : view === 'map' ? (
          <>
            <Card className="p-5">
              <LiveFleetMap height={400} stations={mapStations} />
            </Card>

            {/* Below-map section: Nearby Cabinets */}
            <div className="mt-4">
              {/* Nearby Cabinets table */}
              <Card className="overflow-hidden">
                <div className="border-b px-5 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {t('fastCharging.nearbyCabinets')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-slate-500 dark:text-slate-400 rtl:text-right"
                        style={{ borderColor: 'rgb(var(--border))' }}>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wide">{t('fastCharging.cabinetId')}</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wide">{t('fastCharging.location')}</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wide">{t('fastCharging.status')}</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wide">{t('fastCharging.load')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cabinets.map((c) => {
                        const loadPct = c.totalPorts > 0 ? Math.round((c.chargingPorts / c.totalPorts) * 100) : 0;
                        return (
                          <tr key={c.id} className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                            style={{ borderColor: 'rgb(var(--border))' }}>
                            <td className="px-5 py-3 font-mono font-medium text-slate-700 dark:text-slate-200">{c.cabinetId}</td>
                            <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.district}</td>
                            <td className="px-5 py-3">
                              <span className={cn('font-semibold', statusColor(c.status))}>
                                ● {statusLabel(c.status)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className={cn('h-full rounded-full transition-all',
                                      loadPct >= 80 ? 'bg-rose-500' : loadPct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${loadPct}%` }}
                                  />
                                </div>
                                <span className="tabular-nums text-slate-500">{loadPct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginated.map((c) => (
                <FastChargingCabinetCard key={c.id} cabinet={c} />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
