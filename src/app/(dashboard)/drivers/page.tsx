'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Plane, UserX, DollarSign, Search, Plus } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DriversTable } from '@/components/drivers/DriversTable';
import { DriverFormModal, type DriverFormValues } from '@/components/drivers/DriverFormModal';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
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
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successDialog, setSuccessDialog] = useState<
    | { kind: 'added' }
    | { kind: 'updated' }
    | { kind: 'deleted'; driver: Driver; position: number }
    | null
  >(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await driversApi.list();
      if (!cancelled) {
        setDrivers(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ----- Handlers -----------------------------------------------------------

  const handleAddSubmit = async (values: DriverFormValues) => {
    const created = await driversApi.create({
      name: values.fullName,
      phone: values.phone,
      email: values.email || undefined,
      vehicleModel: values.vehicleModel,
      status: values.status,
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
      vehicleModel: values.vehicleModel,
      status: values.status,
    });
    if (updated) {
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSuccessDialog({ kind: 'updated' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!driverToDelete) return;
    setDeleting(true);
    const position = drivers.findIndex((d) => d.id === driverToDelete.id);
    const removed = await driversApi.remove(driverToDelete.id);
    setDeleting(false);
    if (removed) {
      setDrivers((prev) => prev.filter((d) => d.id !== removed.id));
      setSuccessDialog({ kind: 'deleted', driver: removed, position });
    }
    setDriverToDelete(null);
  };

  const handleUndoDelete = async () => {
    if (successDialog?.kind !== 'deleted') return;
    const { driver, position } = successDialog;
    await driversApi.restore(driver, position);
    setDrivers((prev) => {
      const next = [...prev];
      next.splice(position, 0, driver);
      return next;
    });
  };

  // ----- Render -------------------------------------------------------------

  return (
    <DashboardShell title={t('drivers.title')} subtitle={t('drivers.subtitle')}>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('drivers.activeDrivers')}
          value={120}
          icon={<Bike className="h-5 w-5" />}
          iconColor="indigo"
        />
        <MetricCard
          label={t('drivers.onLeave')}
          value={35}
          icon={<Plane className="h-5 w-5" />}
          iconColor="blue"
        />
        <MetricCard
          label={t('drivers.inactive')}
          value={234}
          icon={<UserX className="h-5 w-5" />}
          iconColor="orange"
        />
        <MetricCard
          label={t('drivers.totalCost')}
          value="278.50"
          unit="SAR"
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="violet"
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
              { value: 'active', label: t('status.active') },
              { value: 'on_leave', label: t('status.onLeave') },
              { value: 'inactive', label: t('status.inactive') },
            ]}
          />

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

      {/* Table */}
      <div className="mt-5">
        {loading ? (
          <Card className="p-5">
            <Skeleton className="h-[400px] w-full" />
          </Card>
        ) : (
          <DriversTable
            drivers={filtered}
            onEdit={(d) => setFormMode({ kind: 'edit', driver: d })}
            onDelete={(d) => setDriverToDelete(d)}
          />
        )}
      </div>

      <Pagination currentPage={page} totalPages={8} onChange={setPage} />

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

      <ConfirmDeleteDialog
        open={!!driverToDelete}
        onClose={() => setDriverToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('drivers.deleteUserTitle')}
        description={t('drivers.deleteUserDescription')}
        confirmLabel={t('drivers.deleteUserConfirm')}
        isLoading={deleting}
      />

      <SuccessDialog
        open={!!successDialog}
        onClose={() => setSuccessDialog(null)}
        variant={successDialog?.kind ?? 'added'}
        onUndo={successDialog?.kind === 'deleted' ? handleUndoDelete : undefined}
      />
    </DashboardShell>
  );
}
