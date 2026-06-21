'use client';

import { useEffect, useMemo, useState } from 'react';
import { Battery, BatteryCharging, Zap, Layers, Map as MapIcon, LayoutGrid, Search } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveFleetMap } from '@/components/dashboard/LiveFleetMap';
import { StationCard } from '@/components/stations/StationCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n/I18nProvider';
import { stationsApi } from '@/lib/api';
import type { BatteryStation } from '@/types';
import { logger } from '@/lib/logger';

type ViewMode = 'map' | 'card';
const PAGE_SIZE = 9;

export default function StationsPage() {
  const { t } = useI18n();
  const [stations, setStations] = useState<BatteryStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedStation, setSelectedStation] = useState<BatteryStation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await stationsApi.list();
        if (!cancelled) {
          setStations(data);
          setSelectedStation(data[0] ?? null);
        }
      } catch (err) {
        logger.error('[Stations] Failed to load stations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(
    () => ({
      available: stations.reduce((s, x) => s + x.available, 0),
      charging: stations.reduce((s, x) => s + x.charging, 0),
      inUse: stations.reduce((s, x) => s + x.inUse, 0),
      capacity: stations.reduce((s, x) => s + x.totalCapacity, 0),
    }),
    [stations]
  );

  const filtered = useMemo(() => {
    let result = stations;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.district.toLowerCase().includes(q)
      );
    }
    return result;
  }, [stations, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardShell title={t('stations.title')} subtitle={t('stations.subtitle')}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('stations.available')}
          value={totals.available}
          icon={<Battery className="h-5 w-5" />}
          iconColor="green"
        />
        <MetricCard
          label={t('stations.charging')}
          value={totals.charging}
          icon={<Zap className="h-5 w-5" />}
          iconColor="blue"
        />
        <MetricCard
          label={t('stations.inUse')}
          value={totals.inUse}
          icon={<BatteryCharging className="h-5 w-5" />}
          iconColor="violet"
        />
        <MetricCard
          label={t('stations.totalCapacity')}
          value={totals.capacity}
          icon={<Layers className="h-5 w-5" />}
          iconColor="indigo"
        />
      </div>

      {/* Toolbar */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {t('stations.stationLocations')}
            </h2>
            <p className="text-xs text-slate-500">{t('stations.realtimeMap')}</p>
          </div>
          <SegmentedControl
            variant="panel"
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { value: 'map', label: t('common.map'), icon: <MapIcon className="h-3.5 w-3.5" /> },
              { value: 'card', label: t('common.card'), icon: <LayoutGrid className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>

        {view === 'map' ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {t('common.all')} {stations.length}
            </Badge>
            <Badge tone="success" dot>
              {t('stations.available')} {totals.available}
            </Badge>
            <Badge tone="info" dot>
              {t('stations.charging')} {totals.charging}
            </Badge>
            <Badge tone="orange" dot>
              {t('stations.inUse')} {totals.inUse}
            </Badge>
          </div>
        ) : (
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
        )}
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </Card>
        ) : view === 'map' ? (
          <Card className="p-5">
            <LiveFleetMap height={500} stations={stations} />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginated.map((s) => (
                <StationCard key={s.id} station={s} onClick={() => setSelectedStation(s)} />
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
