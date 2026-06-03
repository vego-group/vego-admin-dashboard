'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, CreditCard, Shield, ChevronLeft } from 'lucide-react';
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

type Step = 'amount' | 'card';

function balanceColor(bal: number): string {
  if (bal > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (bal >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

type PaymentData = Awaited<ReturnType<typeof walletApi.initiateTopUp>>['paymentData'];

export function TopUpModal({ open, onClose, driver }: TopUpModalProps) {
  const { t, locale } = useI18n();

  const [step, setStep]               = useState<Step>('amount');

  // Amount step
  const [amount, setAmount]           = useState('');
  const [amountError, setAmountError] = useState('');
  const [initiating, setInitiating]   = useState(false);
  const [apiError, setApiError]       = useState('');

  // Card step — data returned by initiateTopUp
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // Balance
  const [fetchedBalance, setFetchedBalance]   = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading]   = useState(false);

  // Moyasar form container
  const moyasarRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (!open || !driver) return;
    setStep('amount');
    setAmount('');
    setAmountError('');
    setApiError('');
    setPaymentData(null);
    setFetchedBalance(null);

    setBalanceLoading(true);
    walletApi.getBalance(driver.id)
      .then((bal) => setFetchedBalance(bal))
      .catch(() => setFetchedBalance(driver.walletBalance ?? 0))
      .finally(() => setBalanceLoading(false));
  }, [open, driver]);

  // Initialize Moyasar form once both step = 'card' and paymentData are ready
  useEffect(() => {
    if (step !== 'card' || !paymentData) return;

    let timer: ReturnType<typeof setTimeout>;

    const tryInit = () => {
      const w = window as typeof window & { Moyasar?: typeof Moyasar };
      if (!w.Moyasar || !moyasarRef.current) {
        timer = setTimeout(tryInit, 150);
        return;
      }

      moyasarRef.current.innerHTML = '';

      // Use backend-provided callback_url; fall back to our page if empty
      const callbackUrl = paymentData.callbackUrl || `${window.location.origin}/payment-callback`;

      w.Moyasar.init({
        element:             moyasarRef.current,
        amount:              paymentData.amount,           // already in halalas
        currency:            paymentData.currency,
        description:         paymentData.description,
        publishable_api_key: paymentData.publishableKey,
        callback_url:        callbackUrl,
        methods:             ['creditcard'],
        metadata:            paymentData.metadata,        // ← MUST be passed unchanged
      });
    };

    tryInit();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentData]);

  if (!driver) return null;

  const numAmount      = parseFloat(amount) || 0;
  const currentBalance = fetchedBalance ?? driver.walletBalance ?? 0;
  const newBalance     = currentBalance + numAmount;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleProceedToCard = async () => {
    const parsed = parseFloat(amount);
    if (!amount.trim() || isNaN(parsed)) { setAmountError(t('drivers.topUpAmountRequired')); return; }
    if (parsed <= 0)                      { setAmountError(t('drivers.topUpAmountInvalid'));  return; }

    setApiError('');
    setInitiating(true);
    try {
      const result = await walletApi.initiateTopUp({ driverId: driver.id, amount: parsed });
      setPaymentData(result.paymentData);
      setStep('card');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.');
    } finally {
      setInitiating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} size="md">

      {/* ── Step 1: Amount ────────────────────────────────────────────────── */}
      {step === 'amount' && (
        <>
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

          <div className="space-y-5 px-6 py-5">
            {/* Driver card */}
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {driver.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{driver.name}</p>
                <p className="text-xs text-slate-400">#{driver.id}</p>
              </div>
              <div className="text-end">
                <p className="mb-0.5 text-[10px] text-slate-400">{t('drivers.currentBalance')}</p>
                {balanceLoading ? (
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : (
                  <p className={cn('text-sm font-bold tabular-nums', balanceColor(currentBalance))}>
                    {formatCurrency(currentBalance, locale)}
                  </p>
                )}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('drivers.topUpAmount')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute start-3.5 text-sm font-medium text-slate-400">SAR</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError(''); if (apiError) setApiError(''); }}
                  min="0"
                  step="0.01"
                  className={cn(
                    'h-11 w-full appearance-none rounded-xl border bg-white ps-14 pe-3.5 text-sm text-slate-700 transition-colors',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                    'dark:bg-slate-900/40 dark:text-slate-200',
                    amountError ? 'border-rose-400' : '',
                  )}
                  style={!amountError ? { borderColor: 'rgb(var(--border))' } : undefined}
                />
              </div>
              {amountError && <p className="mt-1 text-xs text-rose-600">{amountError}</p>}
            </div>

            {/* Quick amounts */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('drivers.quickAmounts')}</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((qa) => (
                  <button
                    key={qa}
                    type="button"
                    onClick={() => { setAmount(String(qa)); if (amountError) setAmountError(''); if (apiError) setApiError(''); }}
                    className={cn(
                      'rounded-lg border px-4 py-1.5 text-xs font-semibold transition-all',
                      numAmount === qa
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                  >
                    {qa} SAR
                  </button>
                ))}
              </div>
            </div>

            {/* API error */}
            {apiError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                {apiError}
              </div>
            )}

            {/* Transaction summary */}
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
                  <div className="border-t pt-2" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{t('drivers.newBalance')}</span>
                      <span className={cn('text-base font-bold tabular-nums', balanceColor(newBalance))}>
                        {formatCurrency(newBalance, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-between gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Secure payment by Moyasar</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose} className="min-w-[90px]">
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={initiating}
                onClick={handleProceedToCard}
                className="min-w-[160px]"
                leftIcon={!initiating ? <CreditCard className="h-4 w-4" /> : undefined}
              >
                {numAmount > 0 ? `Pay ${formatCurrency(numAmount, locale)}` : t('drivers.confirmTopUp')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Step 2: Moyasar card form ──────────────────────────────────────── */}
      {step === 'card' && (
        <>
          <div
            className="flex items-center gap-3 border-b px-6 pb-4 pt-5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <button
              type="button"
              onClick={() => setStep('amount')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors dark:hover:bg-slate-800"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Card Payment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatCurrency(numAmount, locale)} will be charged
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            {/* Moyasar injects the card form here */}
            <div ref={moyasarRef} className="min-h-[280px]" />

            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Encrypted secure payment by Moyasar</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
