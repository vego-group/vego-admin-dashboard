'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap, AlertTriangle, LayoutGrid, Map as MapIcon, Search, Server } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveFleetMap } from '@/components/dashboard/LiveFleetMap';
import { FastChargingCabinetCard } from '@/components/stations/FastChargingCabinetCard';
import { Card } from '@/components/ui/Card';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { Input } from '@/components/ui/Input';
import { LocationLabel } from '@/components/ui/LocationLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError } from '@/components/ui/LoadError';
import { useI18n } from '@/i18n/I18nProvider';
import { fastChargingApi } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import { sharePercent } from '@/lib/format';
import type { FastChargingCabinet, FastChargingStatus } from '@/types';
import { logger } from '@/lib/logger';

type ViewMode = 'map' | 'card';
type FilterTab = 'all' | 'available' | 'charging' | 'error';
const PAGE_SIZE = 9; // 3-column grid — fills rows evenly


export default function FastChargingPage() {
  const { t } = useI18n();
  const [cabinets, setCabinets] = useState<FastChargingCabinet[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // Why the last load failed, said with the backend's words and a Retry. It
  // was the raw English `err.message` over a row of 0 KPIs (FA-312).
  const [loadError, setLoadError] = useState<unknown>(undefined);
  /** The piles have loaded at least once; until then the counts are unknown. */
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fcData = await fastChargingApi.list();
        if (!cancelled) {
          setLoadError(undefined);
          setLoaded(true);
          setCabinets(fcData);
        }
      } catch (err) {
        logger.error('[FastCharging] Failed to load data:', err);
        if (cancelled) return;
        if (isForbiddenError(err)) setForbidden(true);
        else setLoadError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Port totals, for the KPI cards (which say "ports").
  const totals = useMemo(() => ({
    available: cabinets.reduce((s, x) => s + x.availablePorts, 0),
    charging:  cabinets.reduce((s, x) => s + x.chargingPorts,  0),
    error:     cabinets.reduce((s, x) => s + x.errorPorts,     0),
    total:     cabinets.reduce((s, x) => s + x.totalPorts,     0),
  }), [cabinets]);

  // Cabinet counts, for the tabs: each tab filters cabinets by exactly this
  // rule. The tabs used to show the port totals, so "Error (7)" could open a
  // list of one cabinet (FA-321).
  const tabCounts = useMemo(() => ({
    all:       cabinets.length,
    available: cabinets.filter((c) => c.availablePorts > 0).length,
    charging:  cabinets.filter((c) => c.chargingPorts  > 0).length,
    error:     cabinets.filter((c) => c.status === 'error').length,
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

  // Counts only once the piles have loaded: "(0)" after a failure is a claim.
  const counted = (label: string, n: number) => (loaded ? `${label} (${n})` : label);
  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all',       label: counted(t('fastCharging.all'),       tabCounts.all) },
    { value: 'available', label: counted(t('fastCharging.available'), tabCounts.available) },
    { value: 'charging',  label: counted(t('fastCharging.charging'),  tabCounts.charging) },
    { value: 'error',     label: counted(t('fastCharging.error'),     tabCounts.error) },
  ];

  if (forbidden) {
    return (
      <DashboardShell title={t('fastCharging.title')} subtitle={t('fastCharging.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('fastCharging.title')} subtitle={t('fastCharging.subtitle')}>
      {loadError !== undefined && (
        <LoadError
          className="mb-4"
          title={t('fastCharging.loadFailed')}
          lines={failureLines(loadError, t)}
          onRetry={() => setReloadKey((k) => k + 1)}
          retrying={loading}
        />
      )}

      {/* KPI cards — "—" until the piles have loaded, not 0 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label={t('fastCharging.availablePorts')} value={loaded ? totals.available : '—'} icon={<Zap className="h-5 w-5" />}           iconColor="green"  />
        <MetricCard label={t('fastCharging.charging')}       value={loaded ? totals.charging : '—'}  icon={<Zap className="h-5 w-5" />}           iconColor="sky"    />
        <MetricCard label={t('fastCharging.error')}          value={loaded ? totals.error : '—'}     icon={<AlertTriangle className="h-5 w-5" />} iconColor="orange" />
        <MetricCard label={t('fastCharging.totalPorts')}     value={loaded ? totals.total : '—'}     icon={<Server className="h-5 w-5" />}        iconColor="indigo" unit={loaded ? `${cabinets.length} cabinets` : undefined} />
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
        {loading && !loaded ? (
          <Card className="p-5">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </Card>
        ) : !loaded ? null : view === 'map' ? (
          <>
            <Card className="p-5">
              <LiveFleetMap height={400} piles={cabinets} />
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
                        // No ports reported: "—" and an empty bar (FA-308).
                        const loadPct = sharePercent(c.chargingPorts, c.totalPorts);
                        return (
                          <tr key={c.id} className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                            style={{ borderColor: 'rgb(var(--border))' }}>
                            <td className="px-5 py-3 font-mono font-medium text-slate-700 dark:text-slate-200"><span dir="ltr">{c.cabinetId}</span></td>
                            <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                              <LocationLabel
                                coordinates={c.coordinates}
                                parts={[c.district, c.city]}
                                withIcon={false}
                              />
                            </td>
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
                                      loadPct === undefined ? 'bg-transparent'
                                      : loadPct >= 80 ? 'bg-rose-500' : loadPct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${loadPct ?? 0}%` }}
                                  />
                                </div>
                                <span className="tabular-nums text-slate-500">{loadPct === undefined ? '—' : `${loadPct}%`}</span>
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
