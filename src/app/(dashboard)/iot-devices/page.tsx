'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Wifi, WifiOff, SatelliteDish, Search, MapPin, Bike, Battery } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { iotDevicesApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { IoTDevice, DeviceStatus } from '@/types';
import { logger } from '@/lib/logger';

type TabValue = 'all' | DeviceStatus;
const PAGE_SIZE = 12;

const GPS_TONE: Record<IoTDevice['gpsSignal'], { tone: 'success' | 'warning' | 'danger'; key: string }> = {
  strong: { tone: 'success', key: 'iotDevices.gpsStrong' },
  weak:   { tone: 'warning', key: 'iotDevices.gpsWeak' },
  none:   { tone: 'danger',  key: 'iotDevices.gpsNone' },
};

export default function IoTDevicesPage() {
  const { t, locale } = useI18n();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await iotDevicesApi.list();
        if (!cancelled) setDevices(data);
      } catch (err) {
        logger.error('[IoTDevices] Failed to load devices:', err);
        if (!cancelled) setApiError(err instanceof Error ? err.message : 'Failed to load devices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(
    () => ({
      total:   devices.length,
      online:  devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
      weakGps: devices.filter((d) => d.gpsSignal !== 'strong').length,
    }),
    [devices]
  );

  const filtered = useMemo(() => {
    let result = devices;
    if (tab !== 'all') result = result.filter((d) => d.status === tab);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) =>
          d.deviceId.toLowerCase().includes(q) ||
          d.motorcyclePlate?.toLowerCase().includes(q) ||
          d.motorcycleId?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [devices, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardShell title={t('iotDevices.title')} subtitle={t('iotDevices.subtitle')}>
      {apiError && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{apiError}</span>
          <button type="button" onClick={() => setApiError(null)} className="ms-3 shrink-0 text-rose-400 hover:text-rose-600" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label={t('iotDevices.total')}   value={counts.total}   icon={<Cpu className="h-5 w-5" />}           iconColor="indigo" />
        <MetricCard label={t('iotDevices.online')}  value={counts.online}  icon={<Wifi className="h-5 w-5" />}          iconColor="green" />
        <MetricCard label={t('iotDevices.offline')} value={counts.offline} icon={<WifiOff className="h-5 w-5" />}       iconColor="orange" />
        <MetricCard label={t('iotDevices.weakGps')} value={counts.weakGps} icon={<SatelliteDish className="h-5 w-5" />} iconColor="blue" />
      </div>

      {/* Filters */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={tab}
            onChange={(v) => { setTab(v); setPage(1); }}
            options={[
              { value: 'all',     label: t('common.all') },
              { value: 'online',  label: t('iotDevices.online') },
              { value: 'offline', label: t('iotDevices.offline') },
            ]}
          />
          <div className="min-w-[240px] flex-1 sm:max-w-xs">
            <Input
              placeholder={t('iotDevices.searchPlaceholder')}
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
            <EmptyState icon={<Cpu className="h-6 w-6" />} title={t('common.noData')} description={t('iotDevices.empty')} />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right" style={{ borderColor: 'rgb(var(--border))' }}>
                    <th className="px-5 py-4">{t('iotDevices.deviceId')}</th>
                    <th className="px-5 py-4">{t('iotDevices.motorcycle')}</th>
                    <th className="px-5 py-4">{t('iotDevices.status')}</th>
                    <th className="px-5 py-4">{t('iotDevices.battery')}</th>
                    <th className="px-5 py-4">{t('iotDevices.gps')}</th>
                    <th className="px-5 py-4">{t('iotDevices.location')}</th>
                    <th className="px-5 py-4">{t('iotDevices.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((d) => {
                    const gps = GPS_TONE[d.gpsSignal];
                    return (
                      <tr key={d.id} className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40" style={{ borderColor: 'rgb(var(--border))' }}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                            <Cpu className="h-4 w-4 text-slate-400" />
                            {d.deviceId || '—'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {d.motorcyclePlate || d.motorcycleId ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Bike className="h-3.5 w-3.5 text-slate-400" />
                              {d.motorcyclePlate ?? `#${d.motorcycleId}`}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={d.status === 'online' ? 'success' : 'neutral'} dot>
                            {t(d.status === 'online' ? 'iotDevices.online' : 'iotDevices.offline')}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          {d.batteryLevel != null ? (
                            <span className={cn(
                              'inline-flex items-center gap-1.5 font-semibold tabular-nums',
                              d.batteryLevel > 50 ? 'text-emerald-600 dark:text-emerald-400'
                              : d.batteryLevel >= 20 ? 'text-amber-500'
                              : 'text-rose-600 dark:text-rose-400'
                            )}>
                              <Battery className="h-3.5 w-3.5" />
                              {d.batteryLevel}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={gps.tone}>{t(gps.key)}</Badge>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {d.latitude != null && d.longitude != null ? (
                            <a
                              href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                          {d.lastSeenAt ? formatRelativeTime(d.lastSeenAt, locale) : '—'}
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
