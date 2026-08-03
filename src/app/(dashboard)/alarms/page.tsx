'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, AlertOctagon, AlertTriangle, Info, CheckCircle2, Check, Bike, Loader2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { alarmsApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Alarm, AlarmSeverity, AlarmStatus } from '@/types';
import { logger } from '@/lib/logger';

type TabValue = 'all' | AlarmStatus;

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
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('unresolved');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await alarmsApi.list();
        if (!cancelled) setAlarms(data);
      } catch (err) {
        logger.error('[Alarms] Failed to load alarms:', err);
        if (!cancelled) setApiError(err instanceof Error ? err.message : 'Failed to load alarms');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(
    () => ({
      unresolved: alarms.filter((a) => a.status === 'unresolved').length,
      critical:   alarms.filter((a) => a.status === 'unresolved' && a.severity === 'critical').length,
      resolved:   alarms.filter((a) => a.status === 'resolved').length,
    }),
    [alarms]
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return alarms;
    return alarms.filter((a) => a.status === tab);
  }, [alarms, tab]);

  const handleResolve = async (alarm: Alarm) => {
    if (resolvingId) return;
    setResolvingId(alarm.id);
    const ok = await alarmsApi.resolve(alarm.id);
    if (ok) {
      setAlarms((prev) =>
        prev.map((a) => (a.id === alarm.id ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString() } : a))
      );
    }
    setResolvingId(null);
  };

  return (
    <DashboardShell title={t('alarms.title')} subtitle={tv('alarms.subtitle')}>
      {apiError && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{apiError}</span>
          <button type="button" onClick={() => setApiError(null)} className="ms-3 shrink-0 text-rose-400 hover:text-rose-600" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t('alarms.unresolved')}       value={counts.unresolved} icon={<AlarmClock className="h-5 w-5" />}    iconColor="orange" />
        <MetricCard label={t('alarms.criticalOpen')}     value={counts.critical}   icon={<AlertOctagon className="h-5 w-5" />}  iconColor="orange" />
        <MetricCard label={t('alarms.resolved')}         value={counts.resolved}   icon={<CheckCircle2 className="h-5 w-5" />}  iconColor="green" />
      </div>

      {/* Filter */}
      <Card className="mt-5 p-4">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: 'unresolved', label: t('alarms.unresolved') },
            { value: 'resolved',   label: t('alarms.resolved') },
            { value: 'all',        label: t('common.all') },
          ]}
        />
      </Card>

      {/* List */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5"><Skeleton className="h-[360px] w-full" /></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title={t('alarms.allClearTitle')} description={t('alarms.allClearDescription')} />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {filtered.map((a) => {
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
                          <Bike className="h-3 w-3" /> #{a.motorcycleId}
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
    </DashboardShell>
  );
}
