'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Battery, BatteryCharging, Wrench, List, Table as TableIcon, Search } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { VehicleCard } from '@/components/fleet/VehicleCard';
import { FleetTable } from '@/components/fleet/FleetTable';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n/I18nProvider';
import { fleetApi } from '@/lib/api';
import type { Vehicle, VehicleStatus } from '@/types';
import { logger } from '@/lib/logger';

type TabValue = 'all' | VehicleStatus;
type ViewMode = 'list' | 'table';
const PAGE_SIZE = 12;

export default function FleetPage() {
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fleetApi.list();
        if (!cancelled) setVehicles(data);
      } catch (err) {
        logger.error('[Fleet] Failed to load vehicles:', err);
        setApiError(err instanceof Error ? err.message : 'Failed to load vehicles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      active: vehicles.filter((v) => v.status === 'active').length,
      charging: vehicles.filter((v) => v.status === 'charging').length,
      idle: vehicles.filter((v) => v.status === 'idle').length,
      maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    }),
    [vehicles]
  );

  const filtered = useMemo(() => {
    let result = vehicles;
    if (tab !== 'all') result = result.filter((v) => v.status === tab);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (v) =>
          v.id.toLowerCase().includes(q) ||
          v.assignedDriverName?.toLowerCase().includes(q) ||
          v.location.toLowerCase().includes(q)
      );
    }
    if (sort === 'newest') {
      result = [...result].sort((a, b) => +new Date(b.lastTripAt) - +new Date(a.lastTripAt));
    } else {
      result = [...result].sort((a, b) => +new Date(a.lastTripAt) - +new Date(b.lastTripAt));
    }
    return result;
  }, [vehicles, tab, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardShell title={t('fleet.title')} subtitle={t('fleet.subtitle')}>
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

      {/* Status counters */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('fleet.active')}
          value={counts.active}
          icon={<Bike className="h-5 w-5" />}
          iconColor="green"
        />
        <MetricCard
          label={t('fleet.charging')}
          value={counts.charging}
          icon={<BatteryCharging className="h-5 w-5" />}
          iconColor="sky"
        />
        <MetricCard
          label={t('fleet.idle')}
          value={counts.idle}
          icon={<Battery className="h-5 w-5" />}
          iconColor="violet"
        />
        <MetricCard
          label={t('fleet.maintenance')}
          value={counts.maintenance}
          icon={<Wrench className="h-5 w-5" />}
          iconColor="orange"
        />
      </div>

      {/* Filters bar */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'active', label: t('fleet.active') },
              { value: 'charging', label: t('fleet.charging') },
              { value: 'idle', label: t('fleet.idle') },
            ]}
          />

          <SegmentedControl
            variant="panel"
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { value: 'list', label: t('common.list'), icon: <List className="h-3.5 w-3.5" /> },
              { value: 'table', label: t('common.table'), icon: <TableIcon className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder={t('common.searchByName')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'newest', label: t('common.newestFirst') },
              { value: 'oldest', label: t('common.oldestFirst') },
            ]}
            className="w-[200px]"
          />
        </div>
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="mt-3 h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
                <Skeleton className="mt-4 h-2 w-full" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bike className="h-6 w-6" />}
              title={t('common.noData')}
              description="No vehicles match your current filters."
            />
          </Card>
        ) : view === 'list' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginated.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        ) : (
          <FleetTable vehicles={paginated} />
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
      )}
    </DashboardShell>
  );
}
