'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Battery, BatteryCharging, Wrench, List, Table as TableIcon, Search } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { VehicleCard } from '@/components/fleet/VehicleCard';
import { FleetTable } from '@/components/fleet/FleetTable';
import { AssignDriverModal } from '@/components/fleet/AssignDriverModal';
import { Card } from '@/components/ui/Card';
import { NoAccessState } from '@/components/ui/NoAccessState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { LoadError } from '@/components/ui/LoadError';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { fleetApi, driversApi } from '@/lib/api';
import { failureLines, isForbiddenError } from '@/lib/api-errors';
import type { Driver, Vehicle, VehicleStatus } from '@/types';
import { ltrIsolate, parseBackendDate } from '@/lib/format';
import { vehicleDisplayName, vehicleMatches } from '@/lib/vehicle-label';
import { logger } from '@/lib/logger';

type TabValue = 'all' | VehicleStatus;
type ViewMode = 'list' | 'table';
const PAGE_SIZE = 12;

export default function FleetPage() {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  /**
   * Why the last load failed, in the backend's words, with a Retry. It was the
   * raw English `err.message` (or "Failed to load vehicles") in a banner with
   * an English "Dismiss" (FA-215).
   */
  const [loadError, setLoadError] = useState<unknown>(undefined);
  /** The vehicles have loaded at least once; until then the counts are unknown. */
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [forbidden, setForbidden] = useState(false);

  // Driver-assignment modal + success feedback
  const [assignVehicle, setAssignVehicle] = useState<Vehicle | null>(null);
  const [successDialog, setSuccessDialog] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Drivers power the assignment picker; a failure there shouldn't hide the fleet.
        const [vehicleData, driverData] = await Promise.all([
          fleetApi.list(),
          driversApi.list().catch((err) => {
            logger.error('[Fleet] Failed to load drivers for assignment:', err);
            return [] as Driver[];
          }),
        ]);
        if (!cancelled) {
          setVehicles(vehicleData);
          setDrivers(driverData);
          setLoadError(undefined);
          setLoaded(true);
        }
      } catch (err) {
        logger.error('[Fleet] Failed to load vehicles:', err);
        if (cancelled) return;
        if (isForbiddenError(err)) setForbidden(true);
        else setLoadError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // ----- Driver assignment handlers -----------------------------------------

  /** The vehicle's plate (or #id) for a sentence — the bare id was shown as its plate. */
  const plateOf = (motorcycleId: string): string => {
    const vehicle = vehicles.find((v) => v.id === motorcycleId);
    return vehicle ? vehicleDisplayName(vehicle) : `#${motorcycleId}`;
  };

  // A refusal throws through to the picker, which shows the backend's reason.
  const handleAssignDriver = async (motorcycleId: string, driverId: string): Promise<void> => {
    await fleetApi.assignDriver(motorcycleId, driverId);
    const driver = drivers.find((d) => d.id === driverId);
    const driverName = driver?.name ?? driverId;
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === motorcycleId
          ? { ...v, assignedDriverId: driverId, assignedDriverName: driverName }
          : v
      )
    );
    setSuccessDialog({
      title: t('fleet.assignSuccessTitle'),
      // `plate`, not `vehicle`: `{{vehicle}}` is the country's noun for the
      // type, bound by tv(). This names one specific machine.
      description: tv('fleet.assignSuccessDescription', { driver: driverName, plate: ltrIsolate(plateOf(motorcycleId)) }),
    });
  };

  const handleUnassignDriver = async (motorcycleId: string): Promise<void> => {
    await fleetApi.unassignDriver(motorcycleId);
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === motorcycleId
          ? { ...v, assignedDriverId: undefined, assignedDriverName: undefined }
          : v
      )
    );
    setSuccessDialog({
      title: t('fleet.unassignSuccessTitle'),
      description: tv('fleet.unassignSuccessDescription', { plate: ltrIsolate(plateOf(motorcycleId)) }),
    });
  };

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
    if (query) result = result.filter((v) => vehicleMatches(v, query));
    // By when the device last reported. A vehicle that never reported has no
    // time to sort by and goes last either way (FA-217: there are no trips).
    const reportedAt = (v: Vehicle) => parseBackendDate(v.lastSeenAt)?.getTime();
    result = [...result].sort((a, b) => {
      const ta = reportedAt(a), tb = reportedAt(b);
      if (ta === undefined || tb === undefined) {
        return ta === tb ? 0 : ta === undefined ? 1 : -1;
      }
      return sort === 'newest' ? tb - ta : ta - tb;
    });
    return result;
  }, [vehicles, tab, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Never past the last page: a search or a narrower tab can shrink the list
  // under the page the operator is on, which used to leave an empty page with
  // the pager hidden (FA-214).
  const currentPage = Math.min(page, totalPages);
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (forbidden) {
    return (
      <DashboardShell title={t('fleet.title')} subtitle={tv('fleet.subtitle')}>
        <NoAccessState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('fleet.title')} subtitle={tv('fleet.subtitle')}>
      {loadError !== undefined && (
        <LoadError
          className="mb-4"
          title={tv('fleet.loadFailed')}
          lines={failureLines(loadError, t)}
          onRetry={() => setReloadKey((k) => k + 1)}
          retrying={loading}
        />
      )}

      {/* Status counters — "—" until the vehicles have loaded, not 0 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('fleet.active')}
          value={loaded ? counts.active : '—'}
          icon={<Bike className="h-5 w-5" />}
          iconColor="green"
        />
        <MetricCard
          label={t('fleet.charging')}
          value={loaded ? counts.charging : '—'}
          icon={<BatteryCharging className="h-5 w-5" />}
          iconColor="sky"
        />
        <MetricCard
          label={t('fleet.idle')}
          value={loaded ? counts.idle : '—'}
          icon={<Battery className="h-5 w-5" />}
          iconColor="violet"
        />
        <MetricCard
          label={t('fleet.maintenance')}
          value={loaded ? counts.maintenance : '—'}
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
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            options={[
              { value: 'newest', label: t('fleet.sortReportedNewest') },
              { value: 'oldest', label: t('fleet.sortReportedOldest') },
            ]}
            className="w-[200px]"
          />
        </div>
      </Card>

      {/* Content */}
      <div className="mt-5">
        {loading && !loaded ? (
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
        ) : !loaded ? null : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bike className="h-6 w-6" />}
              title={t('common.noData')}
              description={vehicles.length === 0 ? tv('fleet.emptyNone') : t('fleet.emptyNoMatch')}
            />
          </Card>
        ) : view === 'list' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginated.map((v) => (
              <VehicleCard key={v.id} vehicle={v} onAssignDriver={() => setAssignVehicle(v)} />
            ))}
          </div>
        ) : (
          <FleetTable vehicles={paginated} onAssignDriver={(v) => setAssignVehicle(v)} />
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setPage} />
      )}

      {/* Driver assignment */}
      <AssignDriverModal
        open={!!assignVehicle}
        onClose={() => setAssignVehicle(null)}
        vehicle={assignVehicle}
        drivers={drivers}
        onAssign={handleAssignDriver}
        onUnassign={handleUnassignDriver}
      />

      <SuccessDialog
        open={!!successDialog}
        onClose={() => setSuccessDialog(null)}
        variant="updated"
        title={successDialog?.title}
        description={successDialog?.description}
      />
    </DashboardShell>
  );
}
