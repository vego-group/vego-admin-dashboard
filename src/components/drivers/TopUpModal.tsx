'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { walletApi } from '@/lib/api';
import type { Driver } from '@/types';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSuccess?: (updatedDriver: Driver) => void;
}

const QUICK_AMOUNTS = [50, 100, 200, 500];

function balanceColor(bal: number): string {
  if (bal > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (bal >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function TopUpModal({ open, onClose, driver, onSuccess }: TopUpModalProps) {
  const { t, locale } = useI18n();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toppedAmount, setToppedAmount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setPaymentMethod('cash');
    setNote('');
    setError('');
    setSuccess(false);
  }, [open]);

  const numAmount = parseFloat(amount) || 0;
  const currentBalance = driver?.walletBalance ?? 0;
  const newBalance = currentBalance + numAmount;

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = async () => {
    if (!driver) return;
    const parsed = parseFloat(amount);
    if (!amount.trim() || isNaN(parsed)) {
      setError(t('drivers.topUpAmountRequired'));
      return;
    }
    if (parsed <= 0) {
      setError(t('drivers.topUpAmountInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      const updated = await walletApi.topUp(driver.id, parsed, paymentMethod, note || undefined);
      setToppedAmount(parsed);
      setSuccess(true);
      onSuccess?.(updated);
    } finally {
      setSubmitting(false);
    }
  };

  if (!driver) return null;

  return (
    <Modal open={open} onClose={handleClose} size="md">
      {success ? (
        /* ── Success state ─────────────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {t('drivers.topUpSuccess')}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('drivers.topUpSuccessDescription', {
                name: driver.name,
                amount: formatCurrency(toppedAmount, locale),
              })}
            </p>
          </div>
          <div className="w-full rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('drivers.newBalance')}</span>
              <span className={cn('text-lg font-bold tabular-nums', balanceColor(currentBalance + toppedAmount))}>
                {formatCurrency(currentBalance + toppedAmount, locale)}
              </span>
            </div>
          </div>
          <Button variant="primary" onClick={handleClose} className="mt-2 min-w-[140px]">
            {t('common.close')}
          </Button>
        </div>
      ) : (
        <>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div
            className="flex items-start gap-3 border-b px-6 pb-4 pt-5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('drivers.topUpWallet')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('drivers.topUpWalletDescription')}
              </p>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="space-y-5 px-6 py-5">

            {/* Driver info card */}
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {driver.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {driver.name}
                </p>
                <p className="text-xs text-slate-400">#{driver.id}</p>
              </div>
              <div className="text-end">
                <p className="mb-0.5 text-[10px] text-slate-400">{t('drivers.currentBalance')}</p>
                <p className={cn('text-sm font-bold tabular-nums', balanceColor(currentBalance))}>
                  {formatCurrency(currentBalance, locale)}
                </p>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('drivers.topUpAmount')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute start-3.5 text-sm font-medium text-slate-400">
                  SAR
                </span>
                <input
                  type="number"
                  placeholder={t('drivers.topUpAmountPlaceholder')}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError('');
                  }}
                  min="0"
                  step="0.01"
                  className={cn(
                    'h-11 w-full appearance-none rounded-xl border bg-white ps-14 pe-3.5 text-sm text-slate-700 transition-colors',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                    'dark:bg-slate-900/40 dark:text-slate-200'
                  )}
                  style={{ borderColor: 'rgb(var(--border))' }}
                />
              </div>
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            </div>

            {/* Quick amounts */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('drivers.quickAmounts')}
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((qa) => (
                  <button
                    key={qa}
                    type="button"
                    onClick={() => {
                      setAmount(String(qa));
                      if (error) setError('');
                    }}
                    className={cn(
                      'rounded-lg border px-4 py-1.5 text-xs font-semibold transition-all',
                      numAmount === qa
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    )}
                  >
                    {qa} SAR
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('drivers.paymentMethod')}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={cn(
                  'h-11 w-full appearance-none rounded-xl border bg-white px-3.5 text-sm text-slate-700 transition-colors',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  'dark:bg-slate-900/40 dark:text-slate-200'
                )}
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <option value="cash">{t('drivers.paymentMethodCash')}</option>
                <option value="bank_transfer">{t('drivers.paymentMethodBankTransfer')}</option>
                <option value="credit_card">{t('drivers.paymentMethodCreditCard')}</option>
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('drivers.topUpNote')}
              </label>
              <textarea
                placeholder={t('drivers.topUpNotePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={cn(
                  'w-full resize-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-700 transition-colors',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  'dark:bg-slate-900/40 dark:text-slate-200'
                )}
                style={{ borderColor: 'rgb(var(--border))' }}
              />
            </div>

            {/* Transaction summary — shown when amount > 0 */}
            {numAmount > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  {t('drivers.transactionSummary')}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t('drivers.currentBalance')}</span>
                    <span className={cn('font-semibold tabular-nums', balanceColor(currentBalance))}>
                      {formatCurrency(currentBalance, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">+ {t('drivers.topUp')}</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(numAmount, locale)}
                    </span>
                  </div>
                  <div
                    className="border-t pt-2"
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {t('drivers.newBalance')}
                      </span>
                      <span className={cn('text-base font-bold tabular-nums', balanceColor(newBalance))}>
                        {formatCurrency(newBalance, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-end gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <Button type="button" variant="secondary" onClick={handleClose} className="min-w-[110px]">
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={submitting}
              onClick={handleConfirm}
              className="min-w-[140px]"
            >
              {t('drivers.confirmTopUp')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
