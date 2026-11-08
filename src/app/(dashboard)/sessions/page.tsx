'use client';

import { useCallback, useEffect, useState } from 'react';
import { BatteryCharging, Zap, User, MapPin, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError } from '@/components/ui/LoadError';
import { ListPageNote, pageCount } from '@/components/ui/ListPageNote';
import { useI18n } from '@/i18n/I18nProvider';
import { driversApi, sessionsApi, type ListPage } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import { formatRelativeTime } from '@/lib/format';
import { useFleetContext } from '@/hooks/useFleetContext';
import type { Driver, DriverSession, SessionKind, SessionStatus } from '@/types';
import { logger } from '@/lib/logger';

const STATUS_TONE: Record<SessionStatus, { tone: 'success' | 'info' | 'warning' | 'danger'; key: string }> = {
  completed:   { tone: 'success', key: 'sessions.statusCompleted' },
  in_progress: { tone: 'info',    key: 'sessions.statusInProgress' },
  cancelled:   { tone: 'warning', key: 'sessions.statusCancelled' },
  failed:      { tone: 'danger',  key: 'sessions.statusFailed' },
};

interface Filters {
  status: SessionStatus | '';
  driverId: string;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { status: '', driverId: '', from: '', to: '' };

/**
 * Sessions are the platform's activity history, so the whole of it must be
 * reachable: the server pages and filters it (FA-302). This used to fetch the
 * 50 most recent rows and page and search those in the browser, so anything
 * older could not be seen at all.
 */
export default function SessionsPage() {
  const { t, locale } = useI18n();
  const { formatMoney } = useFleetContext();
  const [kind, setKind] = useState<SessionKind>('swap');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListPage<DriverSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const rangeInvalid = !!filters.from && !!filters.to && filters.from > filters.to;

  // The driver filter's options. Without them the filter is just hidden.
  useEffect(() => {
    let cancelled = false;
    driversApi.list()
      .then((d) => { if (!cancelled) setDrivers([...d].sort((a, b) => a.name.localeCompare(b.name))); })
      .catch((err) => logger.warn('[Sessions] Drivers for the filter could not be loaded:', err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (rangeInvalid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const query = {
        status:   filters.status || undefined,
        driverId: filters.driverId || undefined,
        from:     filters.from || undefined,
        to:       filters.to || undefined,
        page,
      };
      try {
        const result = kind === 'swap' ? await sessionsApi.swaps(query) : await sessionsApi.charging(query);
        if (cancelled) return;
        // A page past the end (the data shrank since the last count) steps back.
        if (result.rows.length === 0 && page > 1) {
          setPage(result.lastPage !== undefined ? Math.max(1, Math.min(page - 1, result.lastPage)) : page - 1);
          return;
        }
        setList(result);
      } catch (err) {
        logger.error('[Sessions] Failed to load sessions:', err);
        if (cancelled) return;
        if (isForbiddenError(err)) setForbidden(true);
        else setLoadError(failureLines(err, t));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, filters, page, rangeInvalid, reloadKey, t]);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const hasFilters = filters.status !== '' || filters.driverId !== '' || filters.from !== '' || filters.to !== '';
  const rows = list?.rows ?? [];
  const totalPages = list ? pageCount(list) : 1;

  if (forbidden) {
    return (
      <DashboardShell title={t('sessions.title')} subtitle={t('sessions.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('sessions.title')} subtitle={t('sessions.subtitle')}>
      {/* Kind tabs + filters — every one applied by the server */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            value={kind}
            onChange={(v) => { setKind(v); setPage(1); }}
            options={[
              { value: 'swap',     label: t('sessions.swaps'),    icon: <BatteryCharging className="h-3.5 w-3.5" /> },
              { value: 'charging', label: t('sessions.charging'), icon: <Zap className="h-3.5 w-3.5" /> },
            ]}
          />
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-500">
            {t('sessions.status')}
            <Select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value as Filters['status'])}
              options={[
                { value: '', label: t('sessions.allStatuses') },
                ...(Object.keys(STATUS_TONE) as SessionStatus[]).map((s) => ({ value: s, label: t(STATUS_TONE[s].key) })),
              ]}
            />
          </label>
          {drivers.length > 0 && (
            <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-slate-500">
              {t('sessions.driver')}
              <Select
                value={filters.driverId}
                onChange={(e) => updateFilter('driverId', e.target.value)}
                options={[
                  { value: '', label: t('sessions.allDrivers') },
                  ...drivers.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            {t('sessions.from')}
            <Input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => updateFilter('from', e.target.value)}
              aria-invalid={rangeInvalid}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            {t('sessions.to')}
            <Input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => updateFilter('to', e.target.value)}
              aria-invalid={rangeInvalid}
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilters(NO_FILTERS); setPage(1); }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              {t('sessions.clearFilters')}
            </button>
          )}
        </div>
        {rangeInvalid && (
          <p role="alert" className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            {t('sessions.dateRangeInvalid')}
          </p>
        )}
      </Card>

      {loadError && (
        <LoadError
          className="mt-5"
          title={t('sessions.loadFailed')}
          lines={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
          retrying={loading}
        />
      )}

      {/* Content */}
      <div className="mt-5">
        {loading && !list ? (
          <Card className="p-5"><Skeleton className="h-[400px] w-full" /></Card>
        ) : loadError && !list ? null : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={kind === 'swap' ? <BatteryCharging className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
              title={t('common.noData')}
              description={t('sessions.empty')}
            />
          </Card>
        ) : (
          <Card className={loading ? 'overflow-hidden opacity-60 transition-opacity' : 'overflow-hidden'} aria-busy={loading}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" style={{ borderColor: 'rgb(var(--border))' }}>
                    <th className="px-5 py-4 text-start">{t('sessions.driver')}</th>
                    <th className="px-5 py-4 text-start">{t('sessions.station')}</th>
                    <th className="px-5 py-4 text-start">{t('sessions.status')}</th>
                    <th className="px-5 py-4 text-start">{t('sessions.started')}</th>
                    <th className="px-5 py-4 text-start">{t('sessions.ended')}</th>
                    <th className="px-5 py-4 text-start">{t('sessions.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const st = STATUS_TONE[s.status];
                    return (
                      <tr key={`${s.kind}-${s.id}`} className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40" style={{ borderColor: 'rgb(var(--border))' }}>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {s.driverName ?? (s.driverId ? `#${s.driverId}` : '—')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {s.stationName ? (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {s.stationName}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4"><Badge tone={st.tone} dot>{t(st.key)}</Badge></td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                          {s.startedAt ? formatRelativeTime(s.startedAt, locale) : '—'}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                          {s.endedAt ? formatRelativeTime(s.endedAt, locale) : '—'}
                        </td>
                        <td className="px-5 py-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {s.amount != null ? formatMoney(s.amount, locale) : '—'}
                          {s.couponApplied && (
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-400 dark:text-slate-500">
                              {t('sessions.couponApplied')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {list && rows.length > 0 && <ListPageNote list={list} />}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} disabled={loading} />
      )}
    </DashboardShell>
  );
}
