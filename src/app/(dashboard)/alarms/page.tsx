'use client';

import { useEffect, useState } from 'react';
import { AlarmClock, AlertOctagon, AlertTriangle, Info, CheckCircle2, Check, Bike, Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError } from '@/components/ui/LoadError';
import { ListPageNote, pageCount } from '@/components/ui/ListPageNote';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { alarmsApi, type ListPage } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Alarm, AlarmSeverity, AlarmStatus } from '@/types';
import { logger } from '@/lib/logger';

type TabValue = 'all' | AlarmStatus;

const PAGE_SIZE = 20;
/** Unresolved alarms read to count the critical ones; past this the KPI says "N+". */
const KPI_SAMPLE = 50;

/** A KPI value: a number, "N+" when only a lower bound is known, or "—". */
type Kpi = number | string;

const SEVERITY_CFG: Record<AlarmSeverity, {
  Icon: React.ComponentType<{ className?: string }>;
  tone: 'danger' | 'warning' | 'info';
  iconCls: string;
  key: string;
}> = {
  critical: { Icon: AlertOctagon,  tone: 'danger',  iconCls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',   key: 'alarms.severityCritical' },
  warning:  { Icon: AlertTriangle, tone: 'warning', iconCls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', key: 'alarms.severityWarning' },
  info:     { Icon: Info,          tone: 'info',    iconCls: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',       key: 'alarms.severityInfo' },
};

export default function AlarmsPage() {
  const { t, locale } = useI18n();
  const { tv } = useVehicleTerm();
  const [list, setList] = useState<ListPage<Alarm> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<TabValue>('unresolved');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [kpis, setKpis] = useState<{ unresolved: Kpi; critical: Kpi; resolved: Kpi } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // The list: one page of the selected tab, filtered and paged by the server
  // (FA-306). It used to be the first 50 alarms, filtered in the browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await alarmsApi.list({ status: tab === 'all' ? undefined : tab, page, perPage: PAGE_SIZE });
        if (cancelled) return;
        if (result.rows.length === 0 && page > 1) { setPage(page - 1); return; }
        setList(result);
      } catch (err) {
        logger.error('[Alarms] Failed to load alarms:', err);
        if (cancelled) return;
        if (isForbiddenError(err)) setForbidden(true);
        else setLoadError(failureLines(err, t));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, page, reloadKey, t]);

  // The KPIs, from the server's totals rather than from whatever page is on
  // screen. Critical alarms have no server filter, so they are counted in the
  // first KPI_SAMPLE unresolved ones: exact when that is all of them, "N+" if not.
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      alarmsApi.list({ status: 'unresolved', perPage: KPI_SAMPLE }),
      alarmsApi.list({ status: 'resolved', perPage: 1 }),
    ]).then(([open, closed]) => {
      if (cancelled) return;
      const atLeast = (n: number) => `${formatNumber(n, locale)}+`;
      let unresolved: Kpi = '—';
      let critical: Kpi = '—';
      if (open.status === 'fulfilled') {
        const { rows, total } = open.value;
        const complete = total !== undefined ? rows.length >= total : rows.length < KPI_SAMPLE;
        const crit = rows.filter((a) => a.severity === 'critical').length;
        unresolved = total ?? (complete ? rows.length : atLeast(rows.length));
        critical = complete ? crit : atLeast(crit);
      }
      const resolved: Kpi = closed.status === 'fulfilled' && closed.value.total !== undefined
        ? closed.value.total
        : '—';
      setKpis({ unresolved, critical, resolved });
    });
    return () => { cancelled = true; };
  }, [reloadKey, locale]);

  const rows = list?.rows ?? [];
  const totalPages = list ? pageCount(list) : 1;

  const handleResolve = async (alarm: Alarm) => {
    if (resolvingId) return;
    setResolvingId(alarm.id);
    const ok = await alarmsApi.resolve(alarm.id);
    // Re-read the page and the KPIs: the alarm leaves the Unresolved tab and
    // the counts move, and the server is the one that knows by how much.
    if (ok) setReloadKey((k) => k + 1);
    setResolvingId(null);
  };

  if (forbidden) {
    return (
      <DashboardShell title={t('alarms.title')} subtitle={tv('alarms.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('alarms.title')} subtitle={tv('alarms.subtitle')}>
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t('alarms.unresolved')}       value={kpis?.unresolved ?? '—'} icon={<AlarmClock className="h-5 w-5" />}    iconColor="orange" />
        <MetricCard label={t('alarms.criticalOpen')}     value={kpis?.critical ?? '—'}   icon={<AlertOctagon className="h-5 w-5" />}  iconColor="orange" />
        <MetricCard label={t('alarms.resolved')}         value={kpis?.resolved ?? '—'}   icon={<CheckCircle2 className="h-5 w-5" />}  iconColor="green" />
      </div>

      {/* Filter */}
      <Card className="mt-5 p-4">
        <SegmentedControl
          value={tab}
          onChange={(v) => { setTab(v); setPage(1); }}
          options={[
            { value: 'unresolved', label: t('alarms.unresolved') },
            { value: 'resolved',   label: t('alarms.resolved') },
            { value: 'all',        label: t('common.all') },
          ]}
        />
      </Card>

      {loadError && (
        <LoadError
          className="mt-5"
          title={t('alarms.loadFailed')}
          lines={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
          retrying={loading}
        />
      )}

      {/* List */}
      <div className="mt-5">
        {loading && !list ? (
          <Card className="p-5"><Skeleton className="h-[360px] w-full" /></Card>
        ) : loadError && !list ? null : rows.length === 0 ? (
          <Card>
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title={t('alarms.allClearTitle')} description={t('alarms.allClearDescription')} />
          </Card>
        ) : (
          <Card className={cn('divide-y divide-slate-100 overflow-hidden dark:divide-slate-800', loading && 'opacity-60')} aria-busy={loading}>
            {rows.map((a) => {
              const cfg = SEVERITY_CFG[a.severity];
              const { Icon } = cfg;
              const isResolved = a.status === 'resolved';
              return (
                <div key={a.id} className="flex items-start gap-4 px-5 py-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cfg.iconCls)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">{a.title}</h3>
                      <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(a.createdAt, locale)}</span>
                    </div>
                    {a.description && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.description}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Badge tone={cfg.tone}>{t(cfg.key)}</Badge>
                      {a.motorcycleId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Bike className="h-3 w-3" /> <span dir="ltr">#{a.motorcycleId}</span>
                        </span>
                      )}
                      {isResolved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('alarms.resolved')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleResolve(a)}
                          disabled={!!resolvingId}
                          className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          {resolvingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          {t('alarms.resolve')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
