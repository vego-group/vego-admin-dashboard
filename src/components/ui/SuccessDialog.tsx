'use client';

import { Check, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useI18n } from '@/i18n/I18nProvider';

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  variant: 'added' | 'updated' | 'deleted';
  /** When variant is 'deleted', show an Undo button that calls this. */
  onUndo?: () => void;
  /** Auto-close delay in ms for the 'deleted' variant. Default: 5000. */
  autoCloseMs?: number;
}

export function SuccessDialog({
  open,
  onClose,
  variant,
  onUndo,
  autoCloseMs = 5000,
}: SuccessDialogProps) {
  const { t } = useI18n();
  const isDelete = variant === 'deleted';

  // Countdown for the delete variant — closes the dialog after autoCloseMs.
  const [remaining, setRemaining] = useState(autoCloseMs);

  useEffect(() => {
    // Only the "deleted" variant auto-dismisses; other variants stay until user closes.
    if (!open || !isDelete) return;

    setRemaining(autoCloseMs);

    const tickInterval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 100));
    }, 100);

    const closeTimeout = setTimeout(() => {
      onClose();
    }, autoCloseMs);

    return () => {
      clearInterval(tickInterval);
      clearTimeout(closeTimeout);
    };
  }, [open, isDelete, autoCloseMs, onClose]);

  const title =
    variant === 'added'
      ? t('drivers.userAddedSuccessfully')
      : variant === 'updated'
      ? t('drivers.userUpdatedSuccessfully')
      : t('drivers.userDeletedSuccessfully');

  const description =
    variant === 'added'
      ? t('drivers.userAddedDescription')
      : variant === 'updated'
      ? t('drivers.userUpdatedDescription')
      : t('drivers.userDeletedDescription');

  const progress = isDelete ? (remaining / autoCloseMs) * 100 : 0;
  const secondsLeft = isDelete ? Math.ceil(remaining / 1000) : 0;

  return (
    <Modal open={open} onClose={onClose} size="sm" hideCloseButton>
      <div className="px-6 pb-6 pt-8 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isDelete
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
          }`}
        >
          {isDelete ? (
            <Trash2 className="h-6 w-6" />
          ) : (
            <Check className="h-6 w-6" strokeWidth={2.5} />
          )}
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onClose} className="min-w-[110px]">
            {t('common.close')}
          </Button>
          {isDelete && onUndo && (
            <Button
              variant="primary"
              onClick={() => {
                onUndo();
                onClose();
              }}
              className="min-w-[110px]"
            >
              {t('common.undo')}
              {secondsLeft > 0 && (
                <span className="ms-1 text-xs font-normal opacity-80 tabular-nums">
                  ({secondsLeft}s)
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Countdown bar — visualizes the auto-dismiss timer */}
        {isDelete && (
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}