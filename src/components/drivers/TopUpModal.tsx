'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet, CreditCard, Shield, ChevronLeft, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { logger } from '@/lib/logger';
import { amountStep, fractionDigitsOf, toMinorUnits } from '@/lib/money';
import { useFleetContext } from '@/hooks/useFleetContext';
import { topUpBelowMinimumFrom, walletApi } from '@/lib/api';
import type { Driver, MinTopUpReason, Money, SavedCard, ServicePrice, TopUpOptions } from '@/types';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSuccess?: (updatedDriver: Driver) => void;
}

type Step = 'amount' | 'card';
type CardMode = 'list' | 'new';

function balanceColor(bal: number): string {
  if (bal > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (bal >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function brandLabel(brand: string): string {
  const b = brand.toLowerCase();
  if (b.includes('visa')) return 'VISA';
  if (b.includes('master')) return 'Mastercard';
  if (b.includes('mada')) return 'mada';
  if (b.includes('amex') || b.includes('american')) return 'Amex';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

type PaymentData = Awaited<ReturnType<typeof walletApi.initiateTopUp>>['paymentData'];

export function TopUpModal({ open, onClose, driver }: TopUpModalProps) {
  const { t, locale } = useI18n();
  const { formatMoney, currency, currencyDecimals, currencyStatus } = useFleetContext();

  const [step, setStep]               = useState<Step>('amount');

  // Amount step
  const [amount, setAmount]           = useState('');
  const [amountError, setAmountError] = useState('');
  const [initiating, setInitiating]   = useState(false);
  const [apiError, setApiError]       = useState('');

  // Card step — data returned by initiateTopUp (only for the "new card" form)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // Saved cards
  const [savedCards, setSavedCards]       = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading]   = useState(false);
  const [cardMode, setCardMode]           = useState<CardMode>('new');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [charging, setCharging]           = useState(false);

  // Balance
  const [fetchedBalance, setFetchedBalance]   = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading]   = useState(false);

  // Minimum + suggested chips, per driver
  const [options, setOptions]               = useState<TopUpOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  /**
   * The minimum the backend rejected a submission against (`422
   * topup_below_minimum`). It outranks whatever `topup-options` returned when the
   * modal opened — the balance moved underneath us, and the server's number is
   * the one the next attempt will be judged by.
   */
  const [minOverride, setMinOverride] =
    useState<{ minTopUp: Money; reason: MinTopUpReason | null } | null>(null);

  // Moyasar form container
  const moyasarRef = useRef<HTMLDivElement>(null);

  /**
   * Balance and top-up options, always together.
   *
   * The minimum is derived from the balance — a driver who cannot yet afford one
   * swap has to top up further than one who can — so reading one without the
   * other leaves the form stating a minimum that no longer applies. Every path
   * that credits this wallet has to call this again.
   */
  const loadWallet = useCallback(async (driverId: string, fallbackBalance: number) => {
    setBalanceLoading(true);
    setOptionsLoading(true);

    const balance = walletApi.getBalance(driverId)
      .then((bal) => setFetchedBalance(bal))
      .catch(() => setFetchedBalance(fallbackBalance))
      .finally(() => setBalanceLoading(false));

    const opts = walletApi.getTopUpOptions(driverId)
      .then((next) => { setOptions(next); setMinOverride(null); })
      .catch((err) => {
        // No options means no chips and no stated minimum — never a guessed one.
        // The backend still enforces its floor, and the 422 below reports it.
        logger.warn('[TopUpModal] topup-options unavailable:', err);
        setOptions(null);
      })
      .finally(() => setOptionsLoading(false));

    await Promise.all([balance, opts]);
  }, []);

  // Reset on open
  useEffect(() => {
    if (!open || !driver) return;
    setStep('amount');
    setAmount('');
    setAmountError('');
    setApiError('');
    setPaymentData(null);
    setFetchedBalance(null);
    setOptions(null);
    setMinOverride(null);
    setSavedCards([]);
    setCardMode('new');
    setSelectedCardId(null);
    setCharging(false);

    void loadWallet(driver.id, driver.walletBalance ?? 0);

    // Prefetch saved cards so the card step can default to the list view.
    setCardsLoading(true);
    walletApi.getSavedCards()
      .then((cards) => {
        setSavedCards(cards);
        if (cards.length > 0) setSelectedCardId(cards[0].id);
      })
      .catch(() => setSavedCards([]))
      .finally(() => setCardsLoading(false));
  }, [open, driver, loadWallet]);

  // Initialize Moyasar form once we're on the "new card" view and paymentData is ready
  useEffect(() => {
    if (step !== 'card' || cardMode !== 'new' || !paymentData) return;

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
        language:            locale,                       // follow the app's language (ar/en)
        methods:             ['creditcard'],
        credit_card:         { save_card: true },          // renders the "save this card" checkbox
        metadata:            paymentData.metadata,        // ← MUST be passed unchanged
      });
    };

    tryInit();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cardMode, paymentData]);

  if (!driver) return null;

  const currentBalance = fetchedBalance ?? driver.walletBalance ?? 0;

  // The currency this form is denominated in. The fleet profile is the primary
  // source; `topup-options` states its own currency in the same response as the
  // amounts, so it is an equally authoritative stand-in while the profile is
  // still in flight — and it is never a guess.
  const currencyLabel = currency ?? options?.currency ?? null;
  const knownDecimals = currencyDecimals ?? options?.decimals ?? null;

  // Amounts are held as the raw input string and converted through integer minor
  // units — never parseFloat, so a three-decimal JOD total does not drift.
  //
  // Until the currency resolves we do not know its precision, so we scale to
  // whatever the values themselves carry rather than assuming two decimals.
  // That keeps both operands exact without inventing a currency.
  const scaleDecimals = knownDecimals
    ?? Math.max(fractionDigitsOf(amount), fractionDigitsOf(currentBalance));
  const scale            = 10 ** scaleDecimals;
  const amountMinorUnits = toMinorUnits(amount, scaleDecimals);
  const numAmount        = amountMinorUnits / scale;
  const newBalance       = (toMinorUnits(currentBalance, scaleDecimals) + amountMinorUnits) / scale;

  /**
   * Render an amount the backend sent as part of the top-up options.
   *
   * It carries its own currency and decimals, so the chips and the minimum stay
   * legible even while `/fleet-admin/me` is still loading — where `formatMoney`
   * would (correctly) refuse and render the pending placeholder.
   */
  const formatAmount = (money: Money): string =>
    currencyStatus === 'resolved'
      ? formatMoney(money.amount, locale)
      : formatCurrency(money.amount, money.currency, money.decimals, locale);

  /** Exact comparison against a backend amount, at whichever scale is finer. */
  const compareToInput = (money: Money): number => {
    const decimals = Math.max(scaleDecimals, money.decimals);
    return toMinorUnits(amount, decimals) - toMinorUnits(money.amount, decimals);
  };

  const minTopUp   = minOverride?.minTopUp ?? options?.minTopUp ?? null;
  const minReason  = minOverride ? minOverride.reason : options?.minTopUpReason ?? null;
  // A zero/empty field is "nothing entered yet", not "below the minimum".
  const belowMinimum = minTopUp != null && amountMinorUnits > 0 && compareToInput(minTopUp) < 0;

  const minimumMessage = (money: Money, reason: MinTopUpReason | null): string =>
    reason === 'below_service_price'
      ? t('drivers.minTopUpBelowServicePrice', { amount: formatAmount(money) })
      : t('drivers.minTopUpAbsoluteFloor',     { amount: formatAmount(money) });

  const servicePriceLabel = (service: ServicePrice): string => {
    const key = service.key.toLowerCase();
    if (key.includes('swap'))   return t('drivers.servicePriceBatterySwap');
    if (key.includes('charge')) return t('drivers.servicePriceFastCharge');
    return service.label ?? service.key;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const validateAmount = (): boolean => {
    const trimmed = amount.trim();
    const wellFormed = /^\d*(?:[.,]\d*)?$/.test(trimmed) && /\d/.test(trimmed);
    if (!trimmed || !wellFormed)  { setAmountError(t('drivers.topUpAmountRequired')); return false; }
    if (amountMinorUnits <= 0)    { setAmountError(t('drivers.topUpAmountInvalid'));  return false; }
    if (belowMinimum && minTopUp) { setAmountError(minimumMessage(minTopUp, minReason)); return false; }
    return true;
  };

  /**
   * A `422 topup_below_minimum` is an amount that needs changing, not a failed
   * payment: it belongs on the field, with the minimum the *backend* just quoted
   * rather than the one this form was holding. Returns false for anything else,
   * which the caller then handles as an ordinary failure.
   */
  const handledAsBelowMinimum = (err: unknown): boolean => {
    const rejected = topUpBelowMinimumFrom(err);
    if (!rejected) return false;

    if (rejected.minTopUp) {
      setMinOverride({ minTopUp: rejected.minTopUp, reason: rejected.reason });
      setAmountError(minimumMessage(rejected.minTopUp, rejected.reason));
    } else {
      // No `meta.min_topup` to quote — the backend's own sentence is still better
      // than a generic "payment failed".
      setAmountError(rejected.message);
    }

    // The amount field lives on step 1; there is nothing to fix on the card step.
    setApiError('');
    setPaymentData(null);
    setStep('amount');
    return true;
  };

  /** Provision a pending transaction + Moyasar config for entering a brand-new card. */
  const enterNewCard = async () => {
    setApiError('');
    setCardMode('new');
    setStep('card');
    if (paymentData) return;
    setInitiating(true);
    try {
      const result = await walletApi.initiateTopUp({ driverId: driver.id, amount: numAmount, saveCard: true });
      setPaymentData(result.paymentData);
    } catch (err) {
      if (!handledAsBelowMinimum(err)) {
        setApiError(err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.');
      }
    } finally {
      setInitiating(false);
    }
  };

  const handleProceedToCard = async () => {
    if (!validateAmount()) return;
    setApiError('');
    if (savedCards.length > 0) {
      setCardMode('list');
      setStep('card');
    } else {
      await enterNewCard();
    }
  };

  /** Charge a stored token. Server-side charge may need a 3DS redirect. */
  const handleChargeSaved = async () => {
    if (!selectedCardId) return;
    setApiError('');
    setCharging(true);
    try {
      const res = await walletApi.chargeSavedCard({ driverId: driver.id, amount: numAmount, cardId: selectedCardId });

      // 3DS authentication required — hand off to Moyasar, which returns to /payment-callback.
      if (res.transactionUrl) { window.location.href = res.transactionUrl; return; }

      const s = res.status.toLowerCase();
      if (s === 'paid' || s === 'completed' || s === 'captured') {
        // Already settled server-side — show success without re-verifying (no double credit).
        //
        // The wallet has just been credited, so the balance and the minimum
        // derived from it are both stale here. No `loadWallet()` call belongs on
        // this line: every success path leaves the page for /payment-callback and
        // returns via a fresh /drivers load, so the next open re-reads both. Wire
        // it in if this ever settles without navigating away.
        const q = new URLSearchParams({ status: 'paid', settled: '1' });
        if (res.amount  != null) q.set('amount',  String(res.amount));
        if (res.balance != null) q.set('balance', String(res.balance));
        window.location.href = `/payment-callback?${q.toString()}`;
        return;
      }
      setApiError(t('drivers.chargeFailed'));
    } catch (err) {
      if (!handledAsBelowMinimum(err)) {
        setApiError(err instanceof Error ? err.message : t('drivers.chargeFailed'));
      }
    } finally {
      setCharging(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    if (!window.confirm(t('drivers.removeCardConfirm'))) return;
    try {
      await walletApi.deleteSavedCard(cardId);
      setSavedCards((cards) => {
        const next = cards.filter((c) => c.id !== cardId);
        if (selectedCardId === cardId) setSelectedCardId(next[0]?.id ?? null);
        return next;
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t('drivers.chargeFailed'));
    }
  };

  const headerBack = () => {
    if (cardMode === 'new' && savedCards.length > 0) { setApiError(''); setCardMode('list'); }
    else setStep('amount');
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
                    {formatMoney(currentBalance, locale)}
                  </p>
                )}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {currencyLabel
                  ? t('drivers.topUpAmountWithCurrency', { currency: currencyLabel })
                  : t('drivers.topUpAmount')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                {/* No unit at all until one is known — an unlabelled field beats a
                    field labelled with the wrong currency. */}
                {currencyLabel && (
                  <span className="pointer-events-none absolute start-3.5 text-sm font-medium text-slate-400">
                    {currencyLabel}
                  </span>
                )}
                <input
                  type="number"
                  placeholder={t('drivers.topUpAmountPlaceholder')}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError(''); if (apiError) setApiError(''); }}
                  min="0"
                  step={knownDecimals != null ? amountStep(knownDecimals) : 'any'}
                  className={cn(
                    'h-11 w-full appearance-none rounded-xl border bg-white pe-3.5 text-sm text-slate-700 transition-colors',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                    'dark:bg-slate-900/40 dark:text-slate-200',
                    currencyLabel ? 'ps-14' : 'ps-3.5',
                    amountError || belowMinimum ? 'border-rose-400' : '',
                  )}
                  style={!(amountError || belowMinimum) ? { borderColor: 'rgb(var(--border))' } : undefined}
                />
              </div>

              {/* The minimum is stated up front, and becomes the error the moment
                  the entered amount falls under it. */}
              {amountError ? (
                <p className="mt-1 text-xs text-rose-600">{amountError}</p>
              ) : belowMinimum && minTopUp ? (
                <p className="mt-1 text-xs text-rose-600">{minimumMessage(minTopUp, minReason)}</p>
              ) : minTopUp ? (
                <p className="mt-1 text-xs text-slate-400">
                  {t('drivers.minTopUpHint', { amount: formatAmount(minTopUp) })}
                </p>
              ) : null}

              {/* What the service-price floor is actually made of. */}
              {minReason === 'below_service_price' && options && options.servicePrices.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {t('drivers.servicePricesHint', {
                    prices: options.servicePrices
                      .map((s) => `${servicePriceLabel(s)} ${formatAmount(s.price)}`)
                      .join(' · '),
                  })}
                </p>
              )}
            </div>

            {/* Suggested amounts — rendered exactly as the backend ordered them.
                It has already dropped the chips below the minimum and prepended
                the minimum itself, so there is nothing left here to filter. */}
            {optionsLoading ? (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('drivers.quickAmounts')}</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-7 w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              </div>
            ) : options && options.suggestedAmounts.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('drivers.quickAmounts')}</p>
                <div className="flex flex-wrap gap-2">
                  {options.suggestedAmounts.map((suggested, i) => (
                    <button
                      key={`${suggested.amount}-${i}`}
                      type="button"
                      onClick={() => {
                        // The backend's own fixed-precision string, unrounded.
                        setAmount(suggested.amount);
                        if (amountError) setAmountError('');
                        if (apiError) setApiError('');
                      }}
                      className={cn(
                        'rounded-lg border px-4 py-1.5 text-xs font-semibold transition-all',
                        amountMinorUnits > 0 && compareToInput(suggested) === 0
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      {formatAmount(suggested)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Saved-cards hint */}
            {savedCards.length > 0 && (
              <p className="text-[11px] text-slate-400">
                {savedCards.length === 1
                  ? brandLabel(savedCards[0].brand) + ' •••• ' + savedCards[0].last4
                  : `${savedCards.length} ${t('drivers.savedCards')}`}
              </p>
            )}

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
                      {formatMoney(currentBalance, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">+ {t('drivers.topUp')}</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(numAmount, locale)}
                    </span>
                  </div>
                  <div className="border-t pt-2" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{t('drivers.newBalance')}</span>
                      <span className={cn('text-base font-bold tabular-nums', balanceColor(newBalance))}>
                        {formatMoney(newBalance, locale)}
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
                disabled={belowMinimum}
                onClick={handleProceedToCard}
                className="min-w-[160px]"
                leftIcon={!initiating ? <CreditCard className="h-4 w-4" /> : undefined}
              >
                {numAmount > 0 && currencyStatus !== 'pending'
                  ? `Pay ${formatMoney(numAmount, locale)}`
                  : t('drivers.confirmTopUp')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Step 2: Card (saved list or new card form) ─────────────────────── */}
      {step === 'card' && (
        <>
          <div
            className="flex items-center gap-3 border-b px-6 pb-4 pt-5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <button
              type="button"
              onClick={headerBack}
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
                {cardMode === 'list' ? t('drivers.savedCards') : t('drivers.addNewCardTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatMoney(numAmount, locale)} will be charged
              </p>
            </div>
          </div>

          {/* ── Saved-cards list view ── */}
          {cardMode === 'list' && (
            <div className="px-6 py-5">
              {cardsLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('drivers.savedCardsLoading')}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedCards.map((card) => {
                    const selected = selectedCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl border p-3 transition-colors cursor-pointer',
                          selected
                            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        )}
                        style={!selected ? { borderColor: 'rgb(var(--border))' } : undefined}
                        onClick={() => setSelectedCardId(card.id)}
                      >
                        <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {brandLabel(card.brand)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            •••• {card.last4}
                          </p>
                          {(card.expMonth && card.expYear) ? (
                            <p className="text-[11px] text-slate-400">
                              {t('drivers.expiresShort')
                                .replace('{{month}}', String(card.expMonth).padStart(2, '0'))
                                .replace('{{year}}', String(card.expYear).slice(-2))}
                            </p>
                          ) : card.name ? (
                            <p className="truncate text-[11px] text-slate-400">{card.name}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveCard(card.id); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                          aria-label={t('drivers.removeCard')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                            selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                    );
                  })}

                  {/* Add new card */}
                  <button
                    type="button"
                    onClick={enterNewCard}
                    className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/40"
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    <Plus className="h-4 w-4" />
                    {t('drivers.addNewCard')}
                  </button>
                </div>
              )}

              {apiError && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                  {apiError}
                </div>
              )}

              <Button
                type="button"
                variant="primary"
                isLoading={charging}
                disabled={!selectedCardId || cardsLoading}
                onClick={handleChargeSaved}
                className="mt-5 w-full"
                leftIcon={!charging ? <CreditCard className="h-4 w-4" /> : undefined}
              >
                {t('drivers.payWithCard').replace('{{amount}}', formatMoney(numAmount, locale))}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Encrypted secure payment by Moyasar</span>
              </div>
            </div>
          )}

          {/* ── New-card form view ── */}
          {cardMode === 'new' && (
            <div className="px-6 py-5">
              {apiError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                  {apiError}
                </div>
              )}

              {initiating || !paymentData ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                /* Moyasar injects the card form (incl. its "save card" option) here */
                <div ref={moyasarRef} className="min-h-[280px]" />
              )}

              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Encrypted secure payment by Moyasar</span>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
