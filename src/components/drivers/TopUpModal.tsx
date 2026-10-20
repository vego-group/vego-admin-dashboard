'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, CreditCard, Shield, ChevronLeft, Plus, Loader2, MapPin, AlertTriangle, Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { BillingAddressForm } from '@/components/wallet/BillingAddressForm';
import { SavedCardsList, brandLabel } from '@/components/wallet/SavedCardsList';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import {
  hyperPayAmountIssue,
  readHyperPayHints,
  rememberHyperPayHints,
  storeHyperPayCheckout,
  type HyperPayHints,
} from '@/lib/hyperpay';
import { logger } from '@/lib/logger';
import { amountStep, fractionDigitsOf, toMinorUnits } from '@/lib/money';
import { useFleetContext } from '@/hooks/useFleetContext';
import { hyperPayRefusalFrom, topUpBelowMinimumFrom, walletApi, type MoyasarPaymentData } from '@/lib/api';
import type {
  CardChoice, Driver, HyperPayCheckout, MinTopUpReason, Money, SavedCard, ServicePrice, TopUpOptions,
} from '@/types';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSuccess?: (updatedDriver: Driver) => void;
}

type Step = 'amount' | 'card' | 'billing';
type CardMode = 'list' | 'new';

function balanceColor(bal: number): string {
  if (bal > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (bal >= 10) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

type PaymentData = MoyasarPaymentData;

/**
 * The payment gateway to name in the security footnote, or **null** to name none.
 *
 * Moyasar is a Saudi gateway. Printing "Secure payment by Moyasar" to a
 * Jordanian fleet names a company that is not processing their money — so the
 * gateway is only named where it is known, and the neutral wording is used
 * everywhere else rather than a wrong one.
 *
 * CR-2 replaces this with the gateway the payment-methods endpoint declares per
 * country (`jo_card`, `zaincash`, `orangemoney`, `efawateer`, …). Until that
 * ships, the fleet's own country is the only fact available, and the honest
 * answer for a non-SA fleet is "we don't know yet".
 */
function gatewayNameFor(isoCountryCode: string | null): string | null {
  return isoCountryCode === 'SA' ? 'Moyasar' : null;
}

/** "VISA •••• 0010 · 01/39" — one left-to-right token; render it inside `dir="ltr"`. */
function savedCardToken(card: SavedCard): string {
  const expiry = card.expMonth && card.expYear
    ? ` · ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`
    : '';
  return `${brandLabel(card.brand)} •••• ${card.last4}${expiry}`;
}

export function TopUpModal({ open, onClose, driver }: TopUpModalProps) {
  const { t, locale } = useI18n();
  const { fleet, formatMoney, currency, currencyDecimals, currencyStatus, isoCountryCode } = useFleetContext();
  const router = useRouter();

  const [step, setStep]               = useState<Step>('amount');

  // Amount step
  const [amount, setAmount]           = useState('');
  const [amountError, setAmountError] = useState('');
  const [initiating, setInitiating]   = useState(false);
  const [apiError, setApiError]       = useState('');

  // HyperPay (Jordan). `initiate` is the authority on the gateway; the fleet's
  // country only shapes this form before it answers — the saved-cards list is
  // hidden, the amount is held to HyperPay's two decimals, and the admin picks
  // a saved card or a new one (with "Save this card") before the checkout is
  // created, because `card_choice` decides what the widget will show.
  const [hints, setHints]             = useState<HyperPayHints | null>(null);
  const [saveCard, setSaveCard]       = useState(false);
  const [cardChoice, setCardChoice]   = useState<CardChoice>('new');
  /** Why the choice was switched to a new card (`422 no_saved_cards`). */
  const [cardChoiceNotice, setCardChoiceNotice] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const expectHyperPay = isoCountryCode === 'JO';
  const fleetId = fleet?.id ?? null;

  // Card step — data returned by initiateTopUp (only for the "new card" form)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  // Saved cards
  const [savedCards, setSavedCards]       = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading]   = useState(false);
  const [cardMode, setCardMode]           = useState<CardMode>('new');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  /** The card awaiting "Remove this saved card?". */
  const [confirmCardId, setConfirmCardId] = useState<string | null>(null);
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

  /**
   * This admin's saved cards, both gateways. With `chooseDefault`, a Jordanian
   * form also starts on "Saved card" when there is a HyperPay card to pay with.
   */
  const loadSavedCards = useCallback((chooseDefault: boolean) => {
    setCardsLoading(true);
    return walletApi.getSavedCards()
      .then((cards) => {
        setSavedCards(cards);
        setSelectedCardId((current) => (cards.some((c) => c.id === current) ? current : cards[0]?.id ?? null));
        if (chooseDefault) setCardChoice(cards.some((c) => c.gateway === 'hyperpay') ? 'saved' : 'new');
      })
      .catch(() => setSavedCards([]))
      .finally(() => setCardsLoading(false));
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
    setConfirmCardId(null);
    setCharging(false);
    setSaveCard(false);
    setCardChoice('new');
    setCardChoiceNotice('');
    setRedirecting(false);

    void loadWallet(driver.id, driver.walletBalance ?? 0);

    // Prefetch saved cards: the Saudi card step defaults to the list view, and
    // a Jordanian form offers "Saved card" before anything is initiated.
    void loadSavedCards(true);
  }, [open, driver, loadWallet, loadSavedCards]);

  // Kept apart from the reset above: the fleet profile can resolve while the
  // modal is open, and that must not wipe what the admin has typed.
  useEffect(() => {
    if (open) setHints(readHyperPayHints(fleetId));
  }, [open, fleetId]);

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

  // Named only where the gateway is known — never "Moyasar" to a Jordanian fleet.
  const gateway = gatewayNameFor(isoCountryCode);
  const securePaymentLabel = gateway
    ? t('drivers.securePaymentBy', { gateway })
    : t('drivers.securePayment');
  const encryptedPaymentLabel = gateway
    ? t('drivers.encryptedPaymentBy', { gateway })
    : t('drivers.encryptedPayment');

  const servicePriceLabel = (service: ServicePrice): string => {
    const key = service.key.toLowerCase();
    if (key.includes('swap'))   return t('drivers.servicePriceBatterySwap');
    if (key.includes('charge')) return t('drivers.servicePriceFastCharge');
    return service.label ?? service.key;
  };

  // Jordan pays through HyperPay, so its saved cards are never charged from this
  // form (the widget offers them, and the admin enters the CVV). Only cards that
  // `charge-saved` can take are listed — on a Saudi fleet, all of them.
  const chargeableCards = expectHyperPay ? [] : savedCards.filter((c) => c.gateway !== 'hyperpay');

  // Jordan: the HyperPay cards this admin saved. Choosing "Saved card" sends
  // `card_choice: "saved"`, and the widget lists these for the admin to pick
  // one and enter its CVV. With none there is nothing to choose: a new card.
  const hyperPayCards = expectHyperPay ? savedCards.filter((c) => c.gateway === 'hyperpay') : [];
  const effectiveChoice: CardChoice = hyperPayCards.length > 0 ? cardChoice : 'new';

  const chooseCard = (choice: CardChoice) => {
    setCardChoice(choice);
    setCardChoiceNotice('');
    if (apiError) setApiError('');
  };

  const hyperPayAmountMessage = (code: 'amount_precision' | 'amount_whole_only_in_test'): string =>
    code === 'amount_precision' ? t('wallet.hyperpayAmountPrecision') : t('wallet.hyperpayWholeOnlyInTest');

  // HyperPay's amount rules, checked as the admin types — like the minimum, they
  // keep Pay disabled and put the reason under the field, rather than letting
  // an enabled-looking button answer with an error. The whole-amounts rule
  // applies only once a checkout has said `mode: "test"`.
  const hyperPayIssue = expectHyperPay && amountMinorUnits > 0
    ? hyperPayAmountIssue(amount.trim(), hints?.mode)
    : null;
  const amountInvalid = belowMinimum || hyperPayIssue !== null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const validateAmount = (): boolean => {
    const trimmed = amount.trim();
    const wellFormed = /^\d*(?:[.,]\d*)?$/.test(trimmed) && /\d/.test(trimmed);
    if (!trimmed || !wellFormed)  { setAmountError(t('drivers.topUpAmountRequired')); return false; }
    if (amountMinorUnits <= 0)    { setAmountError(t('drivers.topUpAmountInvalid'));  return false; }
    if (belowMinimum && minTopUp) { setAmountError(minimumMessage(minTopUp, minReason)); return false; }
    if (expectHyperPay) {
      // The whole-amounts rule is only known once a checkout has said `mode: "test"`.
      const issue = hyperPayAmountIssue(trimmed, hints?.mode);
      if (issue) { setAmountError(hyperPayAmountMessage(issue)); return false; }
    }
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

  /**
   * HyperPay's refusals: no billing address yet (collect it, then retry), or an
   * amount HyperPay cannot take (back on the field, in the backend's own words
   * when it sent some). Returns false for anything else.
   */
  const handledAsHyperPayRefusal = (err: unknown): boolean => {
    const refusal = hyperPayRefusalFrom(err);
    if (!refusal) return false;

    if (refusal.code === 'billing_address_required') {
      setApiError('');
      setPaymentData(null);
      setStep('billing');
      return true;
    }
    if (refusal.code === 'amount_precision' || refusal.code === 'amount_whole_only_in_test') {
      setAmountError(refusal.message ?? hyperPayAmountMessage(refusal.code));
      setApiError('');
      setPaymentData(null);
      setStep('amount');
      return true;
    }
    if (refusal.code === 'no_saved_cards') {
      // The card was deleted since this form loaded the list, or the backend
      // cannot use stored cards right now. Say so, switch to a new card and
      // re-read the list; the admin presses Pay again — no checkout was made.
      setCardChoiceNotice(t('wallet.noSavedCardsFound'));
      setCardChoice('new');
      setApiError('');
      setStep('amount');
      void loadSavedCards(false);
      return true;
    }
    return false;
  };

  /**
   * Hand a HyperPay checkout to its own page. COPYandPAY redirects the whole
   * page for 3-D Secure and is not built for React re-mounts, so it is never
   * mounted inside this modal.
   */
  const openHyperPayCheckout = (checkout: HyperPayCheckout) => {
    rememberHyperPayHints(fleetId, checkout);
    storeHyperPayCheckout({
      ...checkout,
      driverName: driver.name || null,
      returnTo:   window.location.pathname,
    });
    setRedirecting(true);
    router.push(`/wallet/top-up/pay?checkout=${encodeURIComponent(checkout.checkoutId)}`);
  };

  /**
   * Provision a pending transaction and the gateway's form for a brand-new card:
   * the Moyasar config (Saudi Arabia), or a HyperPay checkout (Jordan).
   */
  const enterNewCard = async () => {
    setApiError('');
    // A Jordanian top-up never shows the card step: the amount step's button
    // spins until the HyperPay page takes over.
    if (!expectHyperPay) {
      setCardMode('new');
      setStep('card');
    }
    if (paymentData) return;
    setInitiating(true);
    try {
      const result = await walletApi.initiateTopUp({
        driverId: driver.id,
        amount:   numAmount,
        // Moyasar asks "save this card?" inside its own form, so the Saudi
        // request always allows it. The HyperPay widget asks nothing — the
        // admin's checkbox on this form is the consent, and only a new card
        // can be saved (`save_card` is not sent with "saved").
        ...(expectHyperPay
          ? { cardChoice: effectiveChoice, saveCard: effectiveChoice === 'new' && saveCard }
          : { saveCard: true }),
      });
      if (result.gateway === 'hyperpay') {
        openHyperPayCheckout(result);
        return;
      }
      if (expectHyperPay) {
        setCardMode('new');
        setStep('card');
      }
      setPaymentData(result.paymentData);
    } catch (err) {
      if (!handledAsBelowMinimum(err) && !handledAsHyperPayRefusal(err)) {
        setApiError(err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.');
      }
    } finally {
      setInitiating(false);
    }
  };

  const handleProceedToCard = async () => {
    if (!validateAmount()) return;
    setApiError('');
    setCardChoiceNotice('');
    if (chargeableCards.length > 0) {
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
      // A Jordanian fleet: its saved cards are used inside the HyperPay widget,
      // never charged server-side. Go to the widget instead.
      if (hyperPayRefusalFrom(err)?.code === 'use_widget_for_saved_cards') {
        await enterNewCard();
        return;
      }
      if (!handledAsBelowMinimum(err)) {
        setApiError(err instanceof Error ? err.message : t('drivers.chargeFailed'));
      }
    } finally {
      setCharging(false);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    setConfirmCardId(null);
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
    if (cardMode === 'new' && chargeableCards.length > 0) { setApiError(''); setCardMode('list'); }
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
                <p className="text-xs text-slate-400"><span dir="ltr">#{driver.id}</span></p>
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

            {/* A blocked driver can still be funded — a fleet may top up before
                unblocking — but the admin should know the balance is not
                usable yet. Nothing about the payment changes. */}
            {driver.status === 'blocked' && (
              <div
                role="note"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('drivers.topUpBlockedNotice')}</span>
              </div>
            )}

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
                  step={
                    // HyperPay takes two decimals, and whole amounts on its test server.
                    expectHyperPay ? (hints?.mode === 'test' ? 1 : 0.01)
                      : knownDecimals != null ? amountStep(knownDecimals) : 'any'
                  }
                  className={cn(
                    'h-11 w-full appearance-none rounded-xl border bg-white pe-3.5 text-sm text-slate-700 transition-colors',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                    'dark:bg-slate-900/40 dark:text-slate-200',
                    currencyLabel ? 'ps-14' : 'ps-3.5',
                    amountError || amountInvalid ? 'border-rose-400' : '',
                  )}
                  style={!(amountError || amountInvalid) ? { borderColor: 'rgb(var(--border))' } : undefined}
                />
              </div>

              {/* The minimum is stated up front, and becomes the error the moment
                  the entered amount falls under it. HyperPay's rules likewise. */}
              {amountError ? (
                <p className="mt-1 text-xs text-rose-600">{amountError}</p>
              ) : belowMinimum && minTopUp ? (
                <p className="mt-1 text-xs text-rose-600">{minimumMessage(minTopUp, minReason)}</p>
              ) : hyperPayIssue ? (
                <p className="mt-1 text-xs text-rose-600">{hyperPayAmountMessage(hyperPayIssue)}</p>
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
            {chargeableCards.length > 0 && (
              <p className="text-[11px] text-slate-400">
                {chargeableCards.length === 1
                  ? <span dir="ltr">{brandLabel(chargeableCards[0].brand) + ' •••• ' + chargeableCards[0].last4}</span>
                  : `${chargeableCards.length} ${t('drivers.savedCards')}`}
              </p>
            )}

            {/* Jordan: saved card or new card, decided here because it decides
                what the checkout will be. The cards themselves are picked, and
                typed, inside the HyperPay widget on the next page. */}
            {expectHyperPay && cardsLoading && (
              <div className="h-[52px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            )}
            {expectHyperPay && !cardsLoading && hyperPayCards.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('wallet.cardChoiceLabel')}
                </legend>
                <div className="space-y-2">
                  {(['saved', 'new'] as const).map((choice) => {
                    const selected = effectiveChoice === choice;
                    return (
                      <label
                        key={choice}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                          selected
                            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                        )}
                        style={!selected ? { borderColor: 'rgb(var(--border))' } : undefined}
                      >
                        <input
                          type="radio"
                          name="topup-card-choice"
                          value={choice}
                          checked={selected}
                          onChange={() => chooseCard(choice)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            {choice === 'saved' ? t('wallet.cardChoiceSaved') : t('wallet.cardChoiceNew')}
                          </span>
                          {choice === 'saved' && hyperPayCards.map((card) => (
                            <span key={card.id} className="block text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                              <span dir="ltr">{savedCardToken(card)}</span>
                            </span>
                          ))}
                          <span className="block text-[11px] text-slate-400">
                            {choice === 'saved' ? t('wallet.cardChoiceSavedHint') : t('wallet.cardChoiceNewHint')}
                          </span>
                        </span>
                        <CreditCard className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600')} />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* `422 no_saved_cards`: switched to a new card, and why. */}
            {expectHyperPay && cardChoiceNotice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cardChoiceNotice}</span>
              </div>
            )}

            {/* "Save this card" — HyperPay, new card only, unchecked by default.
                Shown on every Jordanian new-card top-up: no flag says before
                `initiate` whether the backend can store cards, and with
                tokenization off it ignores `save_card`. The card is entered,
                and later reused with its CVV, inside the HyperPay widget. */}
            {expectHyperPay && !cardsLoading && effectiveChoice === 'new' && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={(e) => setSaveCard(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600 dark:border-slate-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('wallet.saveCardForLater')}
                  </span>
                  <span className="block text-[11px] text-slate-400">{t('wallet.saveCardForLaterHint')}</span>
                </span>
              </label>
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
              <span>{securePaymentLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose} className="min-w-[90px]">
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={initiating || redirecting}
                // Jordan: not before the saved cards are known — the choice
                // they decide is part of what Pay sends.
                disabled={amountInvalid || (expectHyperPay && cardsLoading)}
                onClick={handleProceedToCard}
                className="min-w-[160px]"
                leftIcon={!(initiating || redirecting) ? <CreditCard className="h-4 w-4" /> : undefined}
              >
                {numAmount > 0 && currencyStatus !== 'pending'
                  ? t('drivers.payAmount', { amount: formatMoney(numAmount, locale) })
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
              aria-label={t('common.back')}
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
                {t('drivers.amountWillBeCharged', { amount: formatMoney(numAmount, locale) })}
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
                  <SavedCardsList
                    cards={chargeableCards}
                    selectedId={selectedCardId}
                    onSelect={setSelectedCardId}
                    onRemove={setConfirmCardId}
                  />

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
                {t('drivers.payWithCard', { amount: formatMoney(numAmount, locale) })}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{encryptedPaymentLabel}</span>
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
                <span>{encryptedPaymentLabel}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Billing address (HyperPay: `422 billing_address_required`) ──────── */}
      {step === 'billing' && (
        <>
          <div
            className="flex items-center gap-3 border-b px-6 pb-4 pt-5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <button
              type="button"
              onClick={() => setStep('amount')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors dark:hover:bg-slate-800"
              aria-label={t('common.back')}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('wallet.billingRequiredTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('wallet.billingRequiredBody')}
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <BillingAddressForm
              submitLabel={t('wallet.billingSaveAndContinue')}
              onCancel={() => setStep('amount')}
              cancelLabel={t('common.back')}
              onSaved={() => {
                // Saved — retry the same top-up straight away.
                setStep('amount');
                void enterNewCard();
              }}
            />
          </div>
        </>
      )}

      {/* Opens over this modal; Escape closes only the dialog on top. */}
      <ConfirmDeleteDialog
        open={confirmCardId !== null}
        onClose={() => setConfirmCardId(null)}
        onConfirm={() => { if (confirmCardId) void handleRemoveCard(confirmCardId); }}
        title={t('drivers.removeCardConfirm')}
        confirmLabel={t('drivers.removeCard')}
        cancelLabel={t('common.cancel')}
      />
    </Modal>
  );
}
