'use client';

import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, CreditCard, Shield, ChevronLeft } from 'lucide-react';
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

type Step = 'amount' | 'card' | 'processing';

function balanceColor(bal: number): string {
  if (bal > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (bal >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/** Format raw digits into "XXXX XXXX XXXX XXXX" */
function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Format raw digits into "MM/YY" */
function formatExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live card preview
// ─────────────────────────────────────────────────────────────────────────────

function CardPreview({
  cardNumber, cardHolder, expiry,
}: { cardNumber: string; cardHolder: string; expiry: string }) {
  const digits = cardNumber.replace(/\s/g, '');

  const group = (start: number) => {
    const chunk = digits.slice(start, start + 4);
    return chunk.padEnd(4, '•');
  };

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-lg select-none">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 end-10 h-32 w-32 rounded-full bg-white/10" />

      {/* Top row: chip + contactless */}
      <div className="relative mb-4 flex items-center justify-between">
        {/* EMV chip */}
        <div className="h-8 w-11 overflow-hidden rounded-md bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm">
          <div className="m-1.5 h-5 w-8 rounded-sm border border-amber-600/30 bg-gradient-to-br from-amber-200 to-amber-400" />
        </div>
        {/* Contactless waves */}
        <svg className="h-6 w-6 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 12.5a7 7 0 0 1 14 0" />
          <path d="M8 15.5a4 4 0 0 1 8 0" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      </div>

      {/* Card number */}
      <p className="relative font-mono text-[17px] tracking-[0.22em] text-white/90">
        {`${group(0)} ${group(4)} ${group(8)} ${group(12)}`}
      </p>

      {/* Holder + Expiry */}
      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/40">Card Holder</p>
          <p className="text-sm font-semibold tracking-wide">
            {cardHolder || 'FULL NAME'}
          </p>
        </div>
        <div className="text-end">
          <p className="text-[9px] uppercase tracking-widest text-white/40">Expires</p>
          <p className="text-sm font-semibold">{expiry || 'MM/YY'}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

export function TopUpModal({ open, onClose, driver, onSuccess }: TopUpModalProps) {
  const { t, locale } = useI18n();

  // Step
  const [step, setStep] = useState<Step>('amount');
  const [success, setSuccess] = useState(false);
  const [toppedAmount, setToppedAmount] = useState(0);

  // Amount step
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');

  // Card step
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Balance
  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open || !driver) return;
    setStep('amount');
    setSuccess(false);
    setAmount('');
    setNote('');
    setAmountError('');
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setCardHolder('');
    setCardErrors({});
    setFetchedBalance(null);

    setBalanceLoading(true);
    walletApi.getBalance(driver.id)
      .then((bal) => setFetchedBalance(bal))
      .catch(() => setFetchedBalance(driver.walletBalance ?? 0))
      .finally(() => setBalanceLoading(false));
  }, [open, driver]);

  if (!driver) return null;

  const numAmount       = parseFloat(amount) || 0;
  const currentBalance  = fetchedBalance ?? driver.walletBalance ?? 0;
  const newBalance      = currentBalance + numAmount;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleProceedToCard = () => {
    const parsed = parseFloat(amount);
    if (!amount.trim() || isNaN(parsed)) { setAmountError(t('drivers.topUpAmountRequired')); return; }
    if (parsed <= 0) { setAmountError(t('drivers.topUpAmountInvalid')); return; }
    setStep('card');
  };

  const validateCard = (): boolean => {
    const errs: Record<string, string> = {};
    if (cardNumber.replace(/\s/g, '').length < 16) errs.cardNumber = 'Enter a valid 16-digit card number';
    if (expiry.length < 5)  errs.expiry     = 'Enter a valid expiry date (MM/YY)';
    if (cvc.length < 3)     errs.cvc        = 'Enter 3-digit CVC';
    if (!cardHolder.trim()) errs.cardHolder = 'Cardholder name is required';
    setCardErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePay = async () => {
    if (!validateCard()) return;
    setSubmitting(true);
    setStep('processing');
    try {
      const parsed  = parseFloat(amount);
      const updated = await walletApi.topUp(driver.id, parsed, 'credit_card', note || undefined);
      setToppedAmount(parsed);
      setFetchedBalance(updated.walletBalance);
      setSuccess(true);
      onSuccess?.(updated);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  /* Success screen */
  if (success) {
    return (
      <Modal open={open} onClose={onClose} size="md">
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
              <span className={cn('text-lg font-bold tabular-nums', balanceColor(currentBalance))}>
                {formatCurrency(currentBalance, locale)}
              </span>
            </div>
          </div>
          <Button variant="primary" onClick={onClose} className="mt-2 min-w-[140px]">
            {t('common.close')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={step === 'processing' ? () => {} : onClose} size="md">

      {/* ── Processing overlay ──────────────────────────────────────────────── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-100 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
            <CreditCard className="h-7 w-7 text-indigo-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Processing payment…
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Please do not close this window
            </p>
          </div>
        </div>
      )}

      {/* ── Step 1: Amount ──────────────────────────────────────────────────── */}
      {step === 'amount' && (
        <>
          {/* Header */}
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
                  onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError(''); }}
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
                    onClick={() => { setAmount(String(qa)); if (amountError) setAmountError(''); }}
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
                  'dark:bg-slate-900/40 dark:text-slate-200',
                )}
                style={{ borderColor: 'rgb(var(--border))' }}
              />
            </div>

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

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            {/* Secure badge — left side */}
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
                onClick={handleProceedToCard}
                className="min-w-[160px]"
                leftIcon={<CreditCard className="h-4 w-4" />}
              >
                {numAmount > 0 ? `Pay ${formatCurrency(numAmount, locale)}` : t('drivers.confirmTopUp')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Step 2: Card details ────────────────────────────────────────────── */}
      {step === 'card' && (
        <>
          {/* Header */}
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

          <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto px-6 py-5">
            {/* Live card preview */}
            <CardPreview cardNumber={cardNumber} cardHolder={cardHolder} expiry={expiry} />

            {/* Fields */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Card details</p>

              <div className="space-y-3">
                {/* Card number */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Card number
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    maxLength={19}
                    onChange={(e) => {
                      setCardNumber(formatCardNumber(e.target.value));
                      if (cardErrors.cardNumber) setCardErrors((p) => ({ ...p, cardNumber: '' }));
                    }}
                    className={cn(
                      'h-11 w-full rounded-xl border bg-white px-3.5 font-mono text-sm text-slate-700 transition-colors',
                      'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                      'dark:bg-slate-900/40 dark:text-slate-200',
                      cardErrors.cardNumber ? 'border-rose-400' : '',
                    )}
                    style={!cardErrors.cardNumber ? { borderColor: 'rgb(var(--border))' } : undefined}
                  />
                  {cardErrors.cardNumber && (
                    <p className="mt-1 text-xs text-rose-600">{cardErrors.cardNumber}</p>
                  )}
                </div>

                {/* MM/YY + CVC */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">MM/YY</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={expiry}
                      maxLength={5}
                      onChange={(e) => {
                        setExpiry(formatExpiry(e.target.value));
                        if (cardErrors.expiry) setCardErrors((p) => ({ ...p, expiry: '' }));
                      }}
                      className={cn(
                        'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-700 transition-colors',
                        'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                        'dark:bg-slate-900/40 dark:text-slate-200',
                        cardErrors.expiry ? 'border-rose-400' : '',
                      )}
                      style={!cardErrors.expiry ? { borderColor: 'rgb(var(--border))' } : undefined}
                    />
                    {cardErrors.expiry && <p className="mt-1 text-xs text-rose-600">{cardErrors.expiry}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">CVC</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="•••"
                      value={cvc}
                      maxLength={3}
                      onChange={(e) => {
                        setCvc(e.target.value.replace(/\D/g, '').slice(0, 3));
                        if (cardErrors.cvc) setCardErrors((p) => ({ ...p, cvc: '' }));
                      }}
                      className={cn(
                        'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-700 transition-colors',
                        'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                        'dark:bg-slate-900/40 dark:text-slate-200',
                        cardErrors.cvc ? 'border-rose-400' : '',
                      )}
                      style={!cardErrors.cvc ? { borderColor: 'rgb(var(--border))' } : undefined}
                    />
                    {cardErrors.cvc && <p className="mt-1 text-xs text-rose-600">{cardErrors.cvc}</p>}
                  </div>
                </div>

                {/* Cardholder name */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Cardholder name
                  </label>
                  <input
                    type="text"
                    placeholder="Full name on card"
                    value={cardHolder}
                    onChange={(e) => {
                      setCardHolder(e.target.value.toUpperCase());
                      if (cardErrors.cardHolder) setCardErrors((p) => ({ ...p, cardHolder: '' }));
                    }}
                    className={cn(
                      'h-11 w-full rounded-xl border bg-white px-3.5 text-sm tracking-wide text-slate-700 transition-colors',
                      'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                      'dark:bg-slate-900/40 dark:text-slate-200',
                      cardErrors.cardHolder ? 'border-rose-400' : '',
                    )}
                    style={!cardErrors.cardHolder ? { borderColor: 'rgb(var(--border))' } : undefined}
                  />
                  {cardErrors.cardHolder && (
                    <p className="mt-1 text-xs text-rose-600">{cardErrors.cardHolder}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Secure badge */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Encrypted secure payment by Moyasar</span>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep('amount')}
              className="min-w-[100px]"
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              isLoading={submitting}
              onClick={handlePay}
              className="min-w-[160px]"
            >
              Pay {formatCurrency(numAmount, locale)}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
