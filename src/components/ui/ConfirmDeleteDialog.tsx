'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Default: "Close". */
  cancelLabel?: string;
  isLoading?: boolean;
  /**
   * Why the confirmed action failed. Shown in the dialog, which stays open so
   * the operator can retry or close it: a refusal must never look like a done.
   */
  error?: string[] | null;
}

/**
 * Confirmation for a destructive action. Focus starts on the safe button, so
 * Enter or Space right after opening never confirms by accident.
 */
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isLoading,
  error,
}: ConfirmDeleteDialogProps) {
  const { t } = useI18n();

  return (
    <Modal open={open} onClose={onClose} size="sm" hideCloseButton>
      <div className="px-6 pb-6 pt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}

        {error && error.length > 0 && (
          <div
            role="alert"
            className="mt-4 space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-start text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
          >
            {error.map((line) => <p key={line} className="break-words">{line}</p>)}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onClose} className="min-w-[110px]" disabled={isLoading} autoFocus>
            {cancelLabel ?? t('common.close')}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
            className="min-w-[140px]"
          >
            {confirmLabel ?? t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
