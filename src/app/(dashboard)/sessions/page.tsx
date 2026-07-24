'use client';

import { useEffect, useMemo, useState } from 'react';
import { BatteryCharging, Zap, Search, User, MapPin } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { sessionsApi } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import type { DriverSession, SessionKind, SessionStatus } from '@/types';
import { logger } from '@/lib/logger';

const PAGE_SIZE = 15;

const STATUS_TONE: Record<SessionStatus, { tone: 'success' | 'info' | 'warning' | 'danger'; key: string }> = {
  completed:   { tone: 'success', key: 'sessions.statusCompleted' },
  in_progress: { tone: 'info',    key: 'sessions.statusInProgress' },
  cancelled:   { tone: 'warning', key: 'sessions.statusCancelled' },
  failed:      { tone: 'danger',  key: 'sessions.statusFailed' },
};

export default function SessionsPage() {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<SessionKind>('swap');
  const [sessions, setSessions] = useState<DriverSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setApiError(null);
      try {
        const data = kind === 'swap' ? await sessionsApi.swaps() : await sessionsApi.charging();
        if (!cancelled) { setSessions(data); setPage(1); }
      } catch (err) {
        logger.error('[Sessions] Failed to load sessions:', err);
        if (!cancelled) setApiError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind]);

  const filtered = useMemo(() => {
    if (!query) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(
      (s) => s.driverName?.toLowerCase().includes(q) || s.stationName?.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardShell title={t('sessions.title')} subtitle={t('sessions.subtitle')}>
      {apiError && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{apiError}</span>
          <button type="button" onClick={() => setApiError(null)} className="ms-3 shrink-0 text-rose-400 hover:text-rose-600" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Kind tabs + search */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={kind}
            onChange={(v) => setKind(v)}
            options={[
              { value: 'swap',     label: t('sessions.swaps'),    icon: <BatteryCharging className="h-3.5 w-3.5" /> },
              { value: 'charging', label: t('sessions.charging'), icon: <Zap className="h-3.5 w-3.5" /> },
            ]}
          />
          <div className="min-w-[240px] flex-1 sm:max-w-xs">
            <Input
              placeholder={t('sessions.searchPlaceholder')}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5"><Skeleton className="h-[400px] w-full" /></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={kind === 'swap' ? <BatteryCharging className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
              title={t('common.noData')}
              description={t('sessions.empty')}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right" style={{ borderColor: 'rgb(var(--border))' }}>
                    <th className="px-5 py-4">{t('sessions.driver')}</th>
                    <th className="px-5 py-4">{t('sessions.station')}</th>
                    <th className="px-5 py-4">{t('sessions.status')}</th>
                    <th className="px-5 py-4">{t('sessions.started')}</th>
                    <th className="px-5 py-4">{t('sessions.ended')}</th>
                    <th className="px-5 py-4">{t('sessions.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
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
                          {s.amount != null ? formatCurrency(s.amount, locale) : '—'}
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

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />}
    </DashboardShell>
  );
}
