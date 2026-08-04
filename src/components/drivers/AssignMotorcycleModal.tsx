'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Bike, UserMinus, Check, Loader2, Battery } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { cn } from '@/lib/cn';
import type { Driver, Vehicle } from '@/types';

interface AssignMotorcycleModalProps {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  motorcycles: Vehicle[];
  /** Returns true on success. Assigns `motorcycleId` to this driver. */
  onAssign: (motorcycleId: string, driverId: string) => Promise<boolean>;
  /** Returns true on success. Clears the driver's current motorcycle. */
  onUnassign: (motorcycleId: string, driverId: string) => Promise<boolean>;
}

/**
 * Assign / change / unassign the motorcycle for a single driver.
 *
 * The backend keeps the relationship on the motorcycle (assign-driver lives under
 * /motorcycles/{id}), so this driver-centric view is just the inverse entry point:
 * pick a motorcycle, and it calls the same endpoint with this driver's id.
 */
export function AssignMotorcycleModal({
  open,
  onClose,
  driver,
  motorcycles,
  onAssign,
  onUnassign,
}: AssignMotorcycleModalProps) {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState<'assign' | 'unassign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedId('');
      setBusy(null);
      setError(null);
    }
  }, [open, driver?.id]);

  // Only motorcycles with no driver (and not the one already on this driver) can be picked.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return motorcycles
      .filter((m) => !m.assignedDriverId && m.id !== driver?.assignedMotorcycleId)
      .filter(
        (m) =>
          !q ||
          m.id.toLowerCase().includes(q) ||
          m.plateNumber.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q)
      );
  }, [motorcycles, driver?.assignedMotorcycleId, query]);

  if (!driver) return null;

  const currentId = driver.assignedMotorcycleId;
  const isAssigned = !!currentId;

  const handleAssign = async () => {
    if (!selectedId || busy) return;
    setBusy('assign');
    setError(null);
    const ok = await onAssign(selectedId, driver.id);
    setBusy(null);
    if (ok) onClose();
    else setError(tv('drivers.assignMotorcycleFailed'));
  };

  const handleUnassign = async () => {
    if (!currentId || busy) return;
    setBusy('unassign');
    setError(null);
    const ok = await onUnassign(currentId, driver.id);
    setBusy(null);
    if (ok) onClose();
    else setError(tv('drivers.unassignMotorcycleFailed'));
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="px-6 pb-6 pt-7">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-base font-bold text-white">
            {driver.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {isAssigned ? tv('drivers.changeMotorcycle') : tv('drivers.assignMotorcycle')}
            </h2>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{driver.name}</p>
          </div>
        </div>

        {/* Currently assigned banner + unassign */}
        {isAssigned && (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl border bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Bike className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400">{tv('drivers.currentMotorcycle')}</p>
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {driver.assignedMotorcyclePlate ?? `#${currentId}`}
                {driver.vehicleModel ? <span className="ms-1 text-xs font-normal text-slate-400">· {driver.vehicleModel}</span> : null}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleUnassign}
              isLoading={busy === 'unassign'}
              disabled={!!busy}
              leftIcon={<UserMinus className="h-4 w-4" />}
              className="!text-rose-600 dark:!text-rose-400"
            >
              {t('drivers.unassignMotorcycle')}
            </Button>
          </div>
        )}

        {/* Motorcycle picker */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {isAssigned ? tv('drivers.changeMotorcycle') : tv('drivers.selectMotorcycle')}
          </p>
          <Input
            placeholder={t('drivers.searchMotorcycles')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />

          <div
            className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border p-1.5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            {candidates.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                {tv('drivers.noAvailableMotorcycles')}
              </p>
            ) : (
              candidates.map((m) => {
                const active = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors rtl:text-right',
                      active ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <Bike className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {m.plateNumber || m.id}
                      </p>
                      <p className="truncate text-xs text-slate-400">{m.model}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-400">
                      <Battery className="h-3.5 w-3.5" />
                      {m.batteryLevel}%
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            isLoading={busy === 'assign'}
            disabled={!selectedId || !!busy}
            leftIcon={busy === 'assign' ? undefined : <Bike className="h-4 w-4" />}
          >
            {isAssigned ? tv('drivers.changeMotorcycle') : tv('drivers.assignMotorcycle')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
