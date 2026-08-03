'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Clock, UserX, Ban, Search, Plus } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DriversTable } from '@/components/drivers/DriversTable';
import { DriverFormModal, type DriverFormValues } from '@/components/drivers/DriverFormModal';
import { TopUpModal } from '@/components/drivers/TopUpModal';
import { AssignMotorcycleModal } from '@/components/drivers/AssignMotorcycleModal';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { useCountries } from '@/hooks/useCountries';
import { useFleetContext } from '@/hooks/useFleetContext';
import { driversApi, fleetApi } from '@/lib/api';
import { toE164 } from '@/lib/country';
import type { CancelledSessions, DialCode, Driver, DriverStatus, Vehicle } from '@/types';
import { logger } from '@/lib/logger';

type TabValue = 'all' | DriverStatus;
type SortValue = 'newest' | 'oldest';
type FormMode = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; driver: Driver };

/**
 * Creation order for a driver, as a sortable number.
 *
 * `GET /fleet-admin/drivers` returns no `created_at`, so the autoincrement id is
 * the ordering key — it *is* creation order, by construction. `createdAt` is
 * preferred the moment the backend starts sending it. Non-numeric ids (fixtures
 * like 'Driv-1001') fall back to 0 and keep their incoming relative order,
 * because the sort below is stable.
 */
function recencyKey(d: Driver): number {
  if (d.createdAt) {
    const ms = Date.parse(d.createdAt);
    if (Number.isFinite(ms)) return ms;
  }
  const id = Number(d.id);
  return Number.isFinite(id) ? id : 0;
}

export default function DriversPage() {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();

  // A driver is created in the fleet's country — fleets do not span countries —
  // so the dial code that builds the E.164 number comes from the fleet profile.
  const { isoCountryCode: fleetIso } = useFleetContext();
  const { byIso } = useCountries();
  const fleetDialCode: DialCode | undefined = byIso(fleetIso)?.dialCode;

  // Data
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [motorcycles, setMotorcycles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tab, setTab] = useState<TabValue>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('newest');
  const [page, setPage] = useState(1);

  // Modals
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' });
  const [driverToTopUp, setDriverToTopUp] = useState<Driver | null>(null);
  const [driverToAssign, setDriverToAssign] = useState<Driver | null>(null);
  const [successDialog, setSuccessDialog] = useState<
    | { kind: 'added' }
    | { kind: 'updated' }
    | { kind: 'statusChanged'; title: string; description: string }
    | null
  >(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Motorcycles power the assignment picker; a failure there shouldn't hide drivers.
        const [driverData, motorcycleData] = await Promise.all([
          driversApi.list(),
          fleetApi.list().catch((err) => {
            logger.error('[Drivers] Failed to load motorcycles for assignment:', err);
            return [] as Vehicle[];
          }),
        ]);
        if (!cancelled) {
          setDrivers(driverData);
          setMotorcycles(motorcycleData);
        }
      } catch (err) {
        logger.error('[Drivers] Failed to load data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let result = drivers;
    if (tab !== 'all') result = result.filter((d) => d.status === tab);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
      );
    }
    // The dropdown used to set state nobody read, so the list never reordered.
    // Copy before sorting — `result` can still be the `drivers` array itself.
    const dir = sort === 'oldest' ? 1 : -1;
    return [...result].sort((a, b) => dir * (recencyKey(a) - recencyKey(b)));
  }, [drivers, tab, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ----- Handlers -----------------------------------------------------------

  /** Upload licence/plate images if the form selected any; returns updated docs. */
  const uploadDocsIfAny = async (driverId: string, values: DriverFormValues) => {
    if (!values.licenseFrontFile && !values.licenseBackFile && !values.plateImageFile) return null;
    return driversApi.uploadDocuments(driverId, {
      licenseFront:  values.licenseFrontFile,
      licenseBack:   values.licenseBackFile,
      licenseNumber: values.licenseNumber || undefined,
      licenseExpiry: values.licenseExpiry || undefined,
      plateImage:    values.plateImageFile,
      plateNumber:   values.plateNumber || undefined,
    });
  };

  const handleAddSubmit = async (values: DriverFormValues) => {
    const created = await driversApi.create({
      name: values.fullName.trim(),
      // Full E.164 plus the dial code, instead of the old hardcoded '966' + phone.
      phone: toE164(values.phone, fleetDialCode),
      dialCode: fleetDialCode,
      email: values.email || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      documents: {
        license: {
          status: values.licenseFrontName ? 'pending' : 'not_uploaded',
          hasLicense: values.hasLicense,
          number: values.licenseNumber || undefined,
          expiryDate: values.licenseExpiry || undefined,
        },
        customsCard: { status: 'not_uploaded' },
        plate: {
          status: values.plateImageName ? 'pending' : 'not_uploaded',
          number: values.plateNumber || undefined,
        },
      },
    });
    const docs = await uploadDocsIfAny(created.id, values);
    const withDocs = docs
      ? { ...created, documents: { ...created.documents, license: docs.license, plate: docs.plate } }
      : created;
    setDrivers((prev) => [withDocs, ...prev]);
    setSuccessDialog({ kind: 'added' });
  };

  const handleEditSubmit = async (values: DriverFormValues, driverId?: string) => {
    if (!driverId) return;

    // On edit, `''` is a deliberate clear and must reach the request body — the
    // `|| undefined` that create uses would turn it back into "not supplied" and
    // the old value would survive. `driversApi.update` guards on `!== undefined`.
    // `name` and `phone` are the exceptions: they are not clearable, the form
    // will not submit either one blank, and a blank would be a 422 by name.
    const updated = await driversApi.update(driverId, {
      name: values.fullName.trim(),
      phone: toE164(values.phone, fleetDialCode),
      dialCode: fleetDialCode,
      email: values.email.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      // Licence expiry and plate number are text fields on this form; they must
      // be sent whether or not the operator also picked a new image.
      documents: {
        license: {
          status:     'not_uploaded',
          hasLicense: values.hasLicense,
          number:     values.licenseNumber.trim(),
          expiryDate: values.licenseExpiry.trim(),
        },
        customsCard: { status: 'not_uploaded' },
        plate: { status: 'not_uploaded', number: values.plateNumber.trim() },
      },
    });

    if (updated) {
      const docs = await uploadDocsIfAny(driverId, values);
      setDrivers((prev) => prev.map((d) => {
        if (d.id !== updated.id) return d;
        return {
          ...updated,
          status:        d.status,
          walletBalance: d.walletBalance,
          trips:         d.trips,
          totalCost:     d.totalCost,
          charges:       d.charges,
          swaps:         d.swaps,
          documents:     docs ? { ...updated.documents, license: docs.license, plate: docs.plate } : updated.documents,
        };
      }));
      setSuccessDialog({ kind: 'updated' });
    }
  };

  const handleTopUpSuccess = (updated: Driver) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, walletBalance: updated.walletBalance } : d)));
  };

  /** Build a "N session(s) cancelled" line from the backend's cancelled_sessions. */
  const cancelledSessionsText = (sessions?: CancelledSessions): string => {
    if (!sessions) return '';
    const swap = sessions.swap_sessions.length;
    const charging = sessions.charging_sessions.length;
    const parts: string[] = [];
    if (swap > 0) {
      parts.push(t(swap === 1 ? 'drivers.swapSessionCancelled' : 'drivers.swapSessionsCancelled', { count: swap }));
    }
    if (charging > 0) {
      parts.push(t(charging === 1 ? 'drivers.chargingSessionCancelled' : 'drivers.chargingSessionsCancelled', { count: charging }));
    }
    return parts.join(' ');
  };

  /** Toggle active ↔ inactive via /toggle-status */
  const handleToggleStatus = async (driver: Driver) => {
    const result = await driversApi.toggleStatus(driver.id);
    if (!result) return;
    setDrivers((prev) =>
      prev.map((d) => (d.id === driver.id ? { ...d, status: result.status } : d))
    );
    // Only surface feedback in the destructive direction (→ inactive); reactivation is silent.
    if (result.status === 'inactive') {
      setSuccessDialog({
        kind: 'statusChanged',
        title: t('drivers.deactivatedSuccessTitle'),
        description: cancelledSessionsText(result.cancelled_sessions),
      });
    }
  };

  /** Block ↔ Unblock via /block or /unblock */
  const handleBlockToggle = async (driver: Driver) => {
    // Unblock — safe direction, no session feedback.
    if (driver.status === 'blocked') {
      const newStatus = await driversApi.unblock(driver.id);
      if (newStatus) {
        setDrivers((prev) =>
          prev.map((d) => (d.id === driver.id ? { ...d, status: newStatus as Driver['status'] } : d))
        );
      }
      return;
    }
    // Block — surface which in-progress sessions were cancelled.
    const result = await driversApi.block(driver.id);
    if (!result) return;
    setDrivers((prev) =>
      prev.map((d) => (d.id === driver.id ? { ...d, status: result.status } : d))
    );
    setSuccessDialog({
      kind: 'statusChanged',
      title: t('drivers.blockedSuccessTitle'),
      description: cancelledSessionsText(result.cancelled_sessions),
    });
  };

  /** Assign / change the motorcycle for a driver (calls the motorcycle endpoint). */
  const handleAssignMotorcycle = async (motorcycleId: string, driverId: string): Promise<boolean> => {
    const ok = await fleetApi.assignDriver(motorcycleId, driverId);
    if (!ok) return false;
    const moto = motorcycles.find((m) => m.id === motorcycleId);
    const driver = drivers.find((d) => d.id === driverId);
    const plate = moto?.plateNumber ?? `#${motorcycleId}`;
    const previousMotorcycleId = driver?.assignedMotorcycleId;

    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? { ...d, assignedMotorcycleId: motorcycleId, assignedMotorcyclePlate: moto?.plateNumber, vehicleModel: moto?.model ?? d.vehicleModel }
          : d
      )
    );
    // Keep the local motorcycle list consistent: the new one is now taken, the old one freed.
    setMotorcycles((prev) =>
      prev.map((m) => {
        if (m.id === motorcycleId) return { ...m, assignedDriverId: driverId, assignedDriverName: driver?.name };
        if (m.id === previousMotorcycleId) return { ...m, assignedDriverId: undefined, assignedDriverName: undefined };
        return m;
      })
    );
    setSuccessDialog({
      kind: 'statusChanged',
      title: tv('drivers.motorcycleAssignedTitle'),
      description: t('drivers.motorcycleAssignedDescription', { motorcycle: plate, driver: driver?.name ?? driverId }),
    });
    return true;
  };

  /** Clear a driver's motorcycle assignment. */
  const handleUnassignMotorcycle = async (motorcycleId: string, driverId: string): Promise<boolean> => {
    const ok = await fleetApi.unassignDriver(motorcycleId);
    if (!ok) return false;
    const driver = drivers.find((d) => d.id === driverId);
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? { ...d, assignedMotorcycleId: undefined, assignedMotorcyclePlate: undefined, vehicleModel: '' }
          : d
      )
    );
    setMotorcycles((prev) =>
      prev.map((m) => (m.id === motorcycleId ? { ...m, assignedDriverId: undefined, assignedDriverName: undefined } : m))
    );
    setSuccessDialog({
      kind: 'statusChanged',
      title: tv('drivers.motorcycleUnassignedTitle'),
      description: tv('drivers.motorcycleUnassignedDescription', { driver: driver?.name ?? driverId }),
    });
    return true;
  };

  // ----- Render -------------------------------------------------------------

  const tabOptions = [
    { value: 'all' as TabValue,      label: t('common.all') },
    { value: 'active' as TabValue,   label: t('status.active') },
    { value: 'blocked' as TabValue,  label: t('status.blocked') },
    { value: 'inactive' as TabValue, label: t('status.inactive') },
  ];

  return (
    <DashboardShell title={t('drivers.title')} subtitle={t('drivers.subtitle')}>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('drivers.activeDrivers')}
          value={drivers.filter((d) => d.status === 'active').length}
          icon={<Bike className="h-5 w-5" />}
          iconColor="indigo"
        />
        <MetricCard
          label={t('drivers.pendingDrivers')}
          value={drivers.filter((d) => d.status === 'pending').length}
          icon={<Clock className="h-5 w-5" />}
          iconColor="blue"
        />
        <MetricCard
          label={t('drivers.inactive')}
          value={drivers.filter((d) => d.status === 'inactive').length}
          icon={<UserX className="h-5 w-5" />}
          iconColor="orange"
        />
        <MetricCard
          label={t('drivers.blockedDrivers')}
          value={drivers.filter((d) => d.status === 'blocked').length}
          icon={<Ban className="h-5 w-5" />}
          iconColor="orange"
        />
      </div>

      {/* Filters bar */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 overflow-x-auto">
            <SegmentedControl
              value={tab}
              onChange={(v) => { setTab(v); setPage(1); }}
              options={tabOptions}
            />
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setFormMode({ kind: 'add' })}
          >
            {t('drivers.addNewDriver')}
          </Button>
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
            onChange={(e) => { setSort(e.target.value as SortValue); setPage(1); }}
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
          <Card className="p-5">
            <Skeleton className="h-[400px] w-full" />
          </Card>
        ) : (
          <DriversTable
            drivers={paginated}
            onEdit={(d) => setFormMode({ kind: 'edit', driver: d })}
            onTopUp={(d) => setDriverToTopUp(d)}
            onToggleStatus={handleToggleStatus}
            onBlockToggle={handleBlockToggle}
            onAssignMotorcycle={(d) => setDriverToAssign(d)}
          />
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
      )}

      {/* Modals */}
      <DriverFormModal
        open={formMode.kind !== 'closed'}
        onClose={() => setFormMode({ kind: 'closed' })}
        driver={formMode.kind === 'edit' ? formMode.driver : null}
        onSubmit={(values, id) =>
          formMode.kind === 'edit'
            ? handleEditSubmit(values, id)
            : handleAddSubmit(values)
        }
      />

      <TopUpModal
        open={!!driverToTopUp}
        onClose={() => setDriverToTopUp(null)}
        driver={driverToTopUp}
        onSuccess={handleTopUpSuccess}
      />

      <AssignMotorcycleModal
        open={!!driverToAssign}
        onClose={() => setDriverToAssign(null)}
        driver={driverToAssign}
        motorcycles={motorcycles}
        onAssign={handleAssignMotorcycle}
        onUnassign={handleUnassignMotorcycle}
      />

      <SuccessDialog
        open={!!successDialog}
        onClose={() => setSuccessDialog(null)}
        variant={successDialog?.kind === 'updated' || successDialog?.kind === 'statusChanged' ? 'updated' : 'added'}
        title={successDialog?.kind === 'statusChanged' ? successDialog.title : undefined}
        description={successDialog?.kind === 'statusChanged' ? successDialog.description : undefined}
      />
    </DashboardShell>
  );
}
