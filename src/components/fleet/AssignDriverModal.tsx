'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, UserMinus, Loader2, Check, Bike } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Driver, Vehicle } from '@/types';

interface AssignDriverModalProps {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  drivers: Driver[];
  /** Returns true on success. */
  onAssign: (motorcycleId: string, driverId: string) => Promise<boolean>;
  /** Returns true on success. */
  onUnassign: (motorcycleId: string) => Promise<boolean>;
}

/**
 * Assign, change, or unassign the driver on a single motorcycle.
 *
 * The motorcycle owns the relationship (mirrors the backend, where assign-driver
 * lives under /motorcycles/{id}), so this modal is vehicle-centric and can be
 * reused anywhere a vehicle is in hand — the Fleet list, a future detail page, etc.
 */
export function AssignDriverModal({
  open,
  onClose,
  vehicle,
  drivers,
  onAssign,
  onUnassign,
}: AssignDriverModalProps) {
  const { t } = useI18n();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState<'assign' | 'unassign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever the modal opens or targets a different vehicle.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedId('');
      setBusy(null);
      setError(null);
    }
  }, [open, vehicle?.id]);

  // Only active drivers can take a motorcycle; the one already on it is excluded.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers
      .filter((d) => d.status === 'active' && d.id !== vehicle?.assignedDriverId)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q));
  }, [drivers, vehicle?.assignedDriverId, query]);

  if (!vehicle) return null;

  const isAssigned = !!vehicle.assignedDriverName;

  const handleAssign = async () => {
    if (!selectedId || busy) return;
    setBusy('assign');
    setError(null);
    const ok = await onAssign(vehicle.id, selectedId);
    setBusy(null);
    if (ok) onClose();
    else setError(t('vehicleControl.assignFailed'));
  };

  const handleUnassign = async () => {
    if (busy) return;
    setBusy('unassign');
    setError(null);
    const ok = await onUnassign(vehicle.id);
    setBusy(null);
    if (ok) onClose();
    else setError(t('vehicleControl.unassignFailed'));
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="px-6 pb-6 pt-7">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <Bike className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {isAssigned ? t('fleet.changeDriver') : t('vehicleControl.assignDriver')}
            </h2>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {vehicle.id} · {vehicle.model}
            </p>
          </div>
        </div>

        {/* Currently assigned banner + unassign */}
        {isAssigned && (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl border bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
              {vehicle.assignedDriverName!.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400">{t('fleet.currentlyAssigned')}</p>
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {vehicle.assignedDriverName}
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
              {t('vehicleControl.unassignDriver')}
            </Button>
          </div>
        )}

        {/* Driver picker */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {isAssigned ? t('fleet.changeDriver') : t('vehicleControl.selectDriver')}
          </p>
          <Input
            placeholder={t('fleet.searchDrivers')}
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
                {t('fleet.noActiveDrivers')}
              </p>
            ) : (
              candidates.map((d) => {
                const active = selectedId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors rtl:text-right',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-xs font-bold text-white dark:from-slate-600 dark:to-slate-700">
                      {d.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {d.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">{d.phone}</p>
                    </div>
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
            leftIcon={busy === 'assign' ? undefined : <UserPlus className="h-4 w-4" />}
          >
            {isAssigned ? t('fleet.changeDriver') : t('vehicleControl.assignDriver')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
