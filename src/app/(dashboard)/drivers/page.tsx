'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Clock, UserX, Ban, Search, Plus } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DriversTable } from '@/components/drivers/DriversTable';
import { DriverFormModal, type DriverFormValues } from '@/components/drivers/DriverFormModal';
import { TopUpModal } from '@/components/drivers/TopUpModal';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { useI18n } from '@/i18n/I18nProvider';
import { driversApi } from '@/lib/api';
import type { Driver, DriverStatus } from '@/types';

type TabValue = 'all' | DriverStatus;
type FormMode = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; driver: Driver };

export default function DriversPage() {
  const { t } = useI18n();

  // Data
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tab, setTab] = useState<TabValue>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Modals
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' });
  const [driverToTopUp, setDriverToTopUp] = useState<Driver | null>(null);
  const [successDialog, setSuccessDialog] = useState<
    | { kind: 'added' }
    | { kind: 'updated' }
    | null
  >(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const driverData = await driversApi.list();
        if (!cancelled) setDrivers(driverData);
      } catch (err) {
        console.error('[Drivers] Failed to load data:', err);
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
    return result;
  }, [drivers, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ----- Handlers -----------------------------------------------------------

  const handleAddSubmit = async (values: DriverFormValues) => {
    const created = await driversApi.create({
      name: values.fullName,
      phone: values.phone,
      email: values.email || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      vehicleModel: values.vehicleModel,
      status: values.status,
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
    setDrivers((prev) => [created, ...prev]);
    setSuccessDialog({ kind: 'added' });
  };

  const handleEditSubmit = async (values: DriverFormValues, driverId?: string) => {
    if (!driverId) return;

    const updated = await driversApi.update(driverId, {
      name: values.fullName,
      phone: values.phone,
      email: values.email || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      vehicleModel: values.vehicleModel,
    });

    if (updated) {
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
        };
      }));
      setSuccessDialog({ kind: 'updated' });
    }
  };

  const handleTopUpSuccess = (updated: Driver) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, walletBalance: updated.walletBalance } : d)));
  };

  /** Toggle active ↔ inactive via /toggle-status */
  const handleToggleStatus = async (driver: Driver) => {
    const newStatus = await driversApi.toggleStatus(driver.id);
    if (newStatus) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, status: newStatus as Driver['status'] } : d))
      );
    }
  };

  /** Block ↔ Unblock via /block or /unblock */
  const handleBlockToggle = async (driver: Driver) => {
    const newStatus = driver.status === 'blocked'
      ? await driversApi.unblock(driver.id)
      : await driversApi.block(driver.id);
    if (newStatus) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, status: newStatus as Driver['status'] } : d))
      );
    }
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

      <SuccessDialog
        open={!!successDialog}
        onClose={() => setSuccessDialog(null)}
        variant={successDialog?.kind ?? 'added'}
      />
    </DashboardShell>
  );
}
