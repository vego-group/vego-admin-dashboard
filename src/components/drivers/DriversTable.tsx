'use client';

import { useState } from 'react';
import { Pencil, IdCard, FileText, Hash, Wallet, Loader2, ShieldX, ShieldCheck, Bike } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { StatusPill } from '@/components/ui/StatusPill';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Driver, DocumentStatus } from '@/types';
import { useFleetContext } from '@/hooks/useFleetContext';

interface DriversTableProps {
  drivers: Driver[];
  onEdit?: (driver: Driver) => void;
  onTopUp?: (driver: Driver) => void;
  onToggleStatus?: (driver: Driver) => Promise<void>;
  onBlockToggle?: (driver: Driver) => Promise<void>;
  onAssignMotorcycle?: (driver: Driver) => void;
}

function walletBalanceColor(balance: number): string {
  if (balance > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (balance >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

// ── Document status dot ────────────────────────────────────────────────────

const DOC_DOT: Record<DocumentStatus, string> = {
  not_uploaded: 'bg-slate-300 dark:bg-slate-600',
  pending:      'bg-amber-400',
  verified:     'bg-emerald-500',
  rejected:     'bg-rose-500',
};

const DOC_LABEL: Record<DocumentStatus, string> = {
  not_uploaded: 'Not Uploaded',
  pending:      'Pending Review',
  verified:     'Verified',
  rejected:     'Rejected',
};

function DocDot({
  status, Icon, label,
}: {
  status: DocumentStatus;
  Icon: React.ElementType;
  label: string;
}) {
  return (
    <span
      title={`${label}: ${DOC_LABEL[status]}`}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-white transition-transform hover:scale-110',
        DOC_DOT[status]
      )}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

function DocsCount(driver: Driver) {
  const docs = driver.documents;
  const all = [docs.license.status, docs.customsCard.status, docs.plate.status];
  const verified = all.filter((s) => s === 'verified').length;
  return { verified, total: 3 };
}

// ── Table ──────────────────────────────────────────────────────────────────

export function DriversTable({ drivers, onEdit, onTopUp, onToggleStatus, onBlockToggle, onAssignMotorcycle }: DriversTableProps) {
  const { t, locale } = useI18n();
  const { formatMoney, currencyStatus } = useFleetContext();

  // Per-row loading state for toggle (active↔inactive)
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Per-row loading state for block/unblock
  const [blockingId, setBlockingId] = useState<string | null>(null);
  // Pending destructive action awaiting confirmation (block or deactivate)
  const [confirmAction, setConfirmAction] = useState<
    { driver: Driver; kind: 'block' | 'deactivate' } | null
  >(null);

  const runToggle = async (driver: Driver) => {
    if (!onToggleStatus || togglingId) return;
    setTogglingId(driver.id);
    try { await onToggleStatus(driver); } finally { setTogglingId(null); }
  };

  const runBlockToggle = async (driver: Driver) => {
    if (!onBlockToggle || blockingId) return;
    setBlockingId(driver.id);
    try { await onBlockToggle(driver); } finally { setBlockingId(null); }
  };

  const handleToggle = (driver: Driver) => {
    // Deactivating (active → inactive) now cancels any in-progress session, so confirm it.
    // Activating (inactive → active) is safe — run immediately.
    if (driver.status === 'active') {
      setConfirmAction({ driver, kind: 'deactivate' });
    } else {
      void runToggle(driver);
    }
  };

  const handleBlockToggle = (driver: Driver) => {
    // Blocking cancels any in-progress session and logs the driver out, so confirm it.
    // Unblocking is safe — run immediately.
    if (driver.status === 'blocked') {
      void runBlockToggle(driver);
    } else {
      setConfirmAction({ driver, kind: 'block' });
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { driver, kind } = confirmAction;
    if (kind === 'deactivate') {
      await runToggle(driver);
    } else {
      await runBlockToggle(driver);
    }
    setConfirmAction(null);
  };

  const confirmIsBusy = confirmAction
    ? confirmAction.kind === 'deactivate'
      ? togglingId === confirmAction.driver.id
      : blockingId === confirmAction.driver.id
    : false;

  return (
    <>
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <th className="px-5 py-4">{t('drivers.driverId')}</th>
              <th className="px-5 py-4">{t('drivers.name')}</th>
              <th className="px-5 py-4">{t('drivers.phone')}</th>
              <th className="px-5 py-4">{t('drivers.vehicles')}</th>
              <th className="px-5 py-4">{t('drivers.status')}</th>
              <th className="px-5 py-4">{t('drivers.documents')}</th>
              <th className="px-5 py-4">{t('drivers.walletBalance')}</th>
              <th className="px-5 py-4">{t('drivers.trips')}</th>
              <th className="px-5 py-4">{t('drivers.totalCost')}</th>
              <th className="px-5 py-4">{t('drivers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const { verified, total } = DocsCount(d);
              const isBlocked = d.status === 'blocked';

              return (
                <tr
                  key={d.id}
                  className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-200">
                    #{d.id}
                  </td>
                  <td className="px-5 py-4 text-slate-900 dark:text-slate-100">{d.name}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{d.phone}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {d.assignedMotorcyclePlate || d.assignedMotorcycleId || d.vehicleModel ? (
                      <div className="flex items-center gap-1.5">
                        <Bike className="h-3.5 w-3.5 text-slate-400" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                            {d.assignedMotorcyclePlate ?? (d.assignedMotorcycleId ? `#${d.assignedMotorcycleId}` : d.vehicleModel)}
                          </p>
                          {d.vehicleModel && (d.assignedMotorcyclePlate || d.assignedMotorcycleId) && (
                            <p className="truncate text-[10px] text-slate-400">{d.vehicleModel}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">{t('drivers.noMotorcycleAssigned')}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={d.status} type="driver" />
                  </td>

                  {/* Documents column */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <DocDot status={d.documents.license.status}    Icon={IdCard}   label={t('drivers.drivingLicense')} />
                        <DocDot status={d.documents.customsCard.status} Icon={FileText} label={t('drivers.customsCard')} />
                        <DocDot status={d.documents.plate.status}       Icon={Hash}     label={t('drivers.licensePlate')} />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-400">
                        {verified}/{total} verified
                      </span>
                    </div>
                  </td>

                  {/* Wallet balance column */}
                  <td className="px-5 py-4">
                    <span className={cn(
                      'font-bold tabular-nums text-sm',
                      // No balance on screen yet — a red/green tint would imply a
                      // judgment about a value we are not showing.
                      currencyStatus === 'pending'
                        ? 'text-slate-400 dark:text-slate-500'
                        : walletBalanceColor(d.walletBalance),
                    )}>
                      {formatMoney(d.walletBalance, locale)}
                    </span>
                  </td>

                  <td className="px-5 py-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {d.trips}
                  </td>
                  <td className="px-5 py-4 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatMoney(d.totalCost, locale)}
                  </td>

                  {/* Actions column */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">

                      {/* Active ↔ Inactive toggle switch */}
                      {onToggleStatus && (
                        <button
                          type="button"
                          onClick={() => handleToggle(d)}
                          disabled={!!togglingId || !!blockingId}
                          title={d.status === 'active' ? t('drivers.deactivate') : t('drivers.activate')}
                          aria-label={d.status === 'active' ? t('drivers.deactivate') : t('drivers.activate')}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
                            'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                            (togglingId === d.id || blockingId === d.id) ? 'opacity-60' : '',
                            d.status === 'active'
                              ? 'bg-emerald-500 hover:bg-emerald-600'
                              : 'bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500',
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform duration-200',
                              d.status === 'active' ? 'translate-x-4' : 'translate-x-0',
                            )}
                          >
                            {togglingId === d.id && (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400" />
                            )}
                          </span>
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onEdit?.(d)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {/* Assign / change motorcycle */}
                      {onAssignMotorcycle && (
                        <button
                          type="button"
                          onClick={() => onAssignMotorcycle(d)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                          aria-label={d.assignedMotorcycleId ? t('drivers.changeMotorcycleAction') : t('drivers.assignMotorcycleAction')}
                          title={d.assignedMotorcycleId ? t('drivers.changeMotorcycleAction') : t('drivers.assignMotorcycleAction')}
                        >
                          <Bike className="h-4 w-4" />
                        </button>
                      )}

                      {/* Top-up wallet */}
                      <button
                        type="button"
                        onClick={() => onTopUp?.(d)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        aria-label={t('drivers.topUp')}
                        title={t('drivers.topUp')}
                      >
                        <Wallet className="h-4 w-4" />
                      </button>

                      {/* Block / Unblock */}
                      {onBlockToggle && (
                        <button
                          type="button"
                          onClick={() => handleBlockToggle(d)}
                          disabled={!!blockingId || !!togglingId}
                          title={isBlocked ? t('drivers.unblock') : t('drivers.block')}
                          aria-label={isBlocked ? t('drivers.unblock') : t('drivers.block')}
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                            blockingId === d.id ? 'opacity-60' : '',
                            isBlocked
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                              : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10',
                          )}
                        >
                          {blockingId === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isBlocked ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <ShieldX className="h-4 w-4" />
                          )}
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>

    <ConfirmDeleteDialog
      open={!!confirmAction}
      onClose={() => { if (!confirmIsBusy) setConfirmAction(null); }}
      onConfirm={handleConfirm}
      isLoading={confirmIsBusy}
      title={
        confirmAction?.kind === 'block'
          ? t('drivers.blockConfirmTitle')
          : t('drivers.deactivateConfirmTitle')
      }
      description={
        confirmAction?.kind === 'block'
          ? t('drivers.blockConfirmDescription')
          : t('drivers.deactivateConfirmDescription')
      }
      confirmLabel={
        confirmAction?.kind === 'block'
          ? t('drivers.block')
          : t('drivers.deactivate')
      }
    />
    </>
  );
}
