'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { brandLabel } from '@/components/wallet/SavedCardsList';
import { walletApi, type HyperPayVerifyResult } from '@/lib/api';
import { ApiError, isIndeterminateFailure } from '@/lib/api/client';
import { serverMessage } from '@/lib/api-errors';
import { ltrIsolate } from '@/lib/format';
import { clearHyperPayCheckout } from '@/lib/hyperpay';
import { useFleetContext } from '@/hooks/useFleetContext';
import { useI18n } from '@/i18n/I18nProvider';
import { logger } from '@/lib/logger';

/**
 * `notCompleted`: the payment ended without money being taken — the checkout
 * expired, or the payment was cancelled, declined or rejected (FA-410).
 */
type Status = 'loading' | 'success' | 'failed' | 'notCompleted' | 'pending';

/**
 * HyperPay verify statuses that end a payment with **no money taken** (FA-410).
 * Reconciliation marks an abandoned checkout `expired`; a cancelled, declined
 * or rejected payment was never captured. These used to read "being confirmed,
 * the balance will update shortly", for a payment that never will. Anything not
 * listed here, and not `completed` / `failed`, stays pending: the backend's
 * status list is not documented, and an unknown one may still settle.
 */
const NOT_COMPLETED_STATUSES: ReadonlySet<string> = new Set([
  'expired', 'cancelled', 'canceled', 'declined', 'rejected',
]);

/** What a HyperPay verify status means for this page. */
function hyperPayStatus(raw: string | null): Exclude<Status, 'loading'> {
  if (raw === 'completed') return 'success';
  if (raw === 'failed') return 'failed';
  if (raw && NOT_COMPLETED_STATUSES.has(raw)) return 'notCompleted';
  return 'pending';
}

/**
 * One verify per HyperPay checkout, shared by every mount in this tab.
 *
 * HyperPay allows a single status check per payment. The backend already
 * guarantees that (a repeat verify returns its stored result), but this page
 * still asks only once: React's development double-mount reuses the promise,
 * and a refresh after a final answer is caught by the `settled=1` marker below.
 * A pending answer is not final (FA-409): it is never marked, so a refresh asks
 * again, and "Check again" drops the cached promise and asks again — the
 * backend answers with its stored status, or the one a webhook or
 * reconciliation has since recorded.
 */
const hyperPayVerifications = new Map<string, Promise<HyperPayVerifyResult>>();

/** The same for Moyasar payments, keyed by payment id (FA-407). */
const moyasarVerifications = new Map<string, ReturnType<typeof walletApi.verifyTopUp>>();

/**
 * A failed verify call that is a refusal of the request itself (unknown
 * payment, bad input): the payment failed. Anything else — the network, a
 * timeout, a 5xx, an expired session, an unreadable answer — says nothing about
 * the payment, which the webhook and reconciliation still settle; claiming
 * "failed" there invites the admin to pay twice. Both gateways use this rule.
 */
function isRefusal(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && !isIndeterminateFailure(err);
}

/**
 * The backend's own words for a refusal — its field messages first — or null
 * for the client's bare "HTTP 422", so the translated default shows (FA-422).
 */
function refusalMessage(err: ApiError): string | null {
  return serverMessage(err);
}

/** The checkout id from `?id=`, or out of `resourcePath=/v1/checkouts/<id>/payment`. */
function hyperPayCheckoutId(params: URLSearchParams): string | null {
  const id = params.get('id');
  if (id) return id;
  const match = /\/checkouts\/([^/?#]+)/.exec(params.get('resourcePath') ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

export default function PaymentCallbackPage() {
  const { t, locale, dir } = useI18n();
  const { formatMoney } = useFleetContext();
  const [status, setStatus]     = useState<Status>('loading');
  // Held as the raw fixed-precision strings the gateway/backend returned, and
  // parsed at render time against the fleet's own decimal count.
  const [amount, setAmount]     = useState<string | null>(null);
  const [balance, setBalance]   = useState<string | null>(null);
  // The gateway's own failure message, verbatim. Without one, the localised
  // default is shown.
  const [gatewayMsg, setGatewayMsg] = useState<string | null>(null);
  // HyperPay only: the card that paid, and the "being confirmed" wording.
  const [card, setCard]         = useState<{ brand: string; last4: string } | null>(null);
  const [isHyperPay, setIsHyperPay] = useState(false);
  // Pending because the verify call got no usable answer (network, timeout,
  // 5xx, no status) — not because the gateway said "pending".
  const [uncertain, setUncertain] = useState(false);
  // `notCompleted` because the checkout ran out, rather than a refusal.
  const [expired, setExpired]   = useState(false);
  // HyperPay: the checkout a pending answer can be asked about again (FA-409),
  // whether "Check again" is running, and whether it answered pending again.
  const [recheckId, setRecheckId] = useState<string | null>(null);
  const [checking, setChecking]   = useState(false);
  const [stillPending, setStillPending] = useState(false);

  const showHyperPay = useCallback((s: Exclude<Status, 'loading'>, r: {
    amount?: string | null; balance?: string | null;
    brand?: string | null; last4?: string | null; message?: string | null;
    rawStatus?: string | null;
  }) => {
    setAmount(r.amount ?? null);
    setBalance(r.balance ?? null);
    setCard(s === 'success' && r.brand && r.last4 ? { brand: r.brand, last4: r.last4 } : null);
    setGatewayMsg(s === 'failed' ? r.message ?? null : null);
    setExpired(s === 'notCompleted' && r.rawStatus === 'expired');
    setStatus(s);
  }, []);

  /**
   * Verify a HyperPay checkout and show the answer. `fresh` asks again even if
   * this tab already has an answer — "Check again" on a pending result.
   * Resolves whatever happens; failures are shown, not thrown.
   */
  const verifyHyperPay = useCallback((checkoutId: string, fresh: boolean): Promise<void> => {
    if (fresh) hyperPayVerifications.delete(checkoutId);
    let verification = hyperPayVerifications.get(checkoutId);
    if (!verification) {
      // Send only the id; the backend builds HyperPay's status URL itself.
      verification = walletApi.verifyHyperPayTopUp(checkoutId);
      hyperPayVerifications.set(checkoutId, verification);
    }
    setRecheckId(checkoutId);

    return verification
      .then((result) => {
        const s = hyperPayStatus(result.status);
        if (s === 'pending' && result.status !== 'pending') {
          logger.warn(`[payment-callback] HyperPay verify returned status "${result.status}"; showing pending.`);
        }
        const shown = {
          amount:  result.amount,
          balance: result.balance,
          brand:   result.cardBrand ? brandLabel(result.cardBrand) : null,
          last4:   result.cardLast4,
          message: result.resultDescription,
        };
        setUncertain(false);
        setStillPending(fresh && s === 'pending');
        showHyperPay(s, { ...shown, rawStatus: result.status });

        // A final answer marks the URL, like the saved-card `settled=1`
        // hand-off, so a refresh shows it rather than asking again. A
        // not-completed answer keeps its own status, so a refresh can still
        // tell "expired" from "declined". Pending is not final and is never
        // marked (FA-409): a refresh, or "Check again", asks again.
        if (s !== 'pending') {
          const marked = new URLSearchParams(window.location.search);
          marked.set('settled', '1');
          marked.set('status', result.status);
          for (const [key, value] of Object.entries(shown)) {
            if (value) marked.set(key, value); else marked.delete(key);
          }
          window.history.replaceState(null, '', `${window.location.pathname}?${marked.toString()}`);
        }
        clearHyperPayCheckout(checkoutId);
      })
      .catch((err) => {
        logger.error('[payment-callback] HyperPay verify error:', err);
        hyperPayVerifications.delete(checkoutId);
        setStillPending(false);
        // See isRefusal. The URL stays unmarked so a refresh asks again.
        if (isRefusal(err)) showHyperPay('failed', { message: refusalMessage(err) });
        else { setUncertain(true); showHyperPay('pending', {}); }
      });
  }, [showHyperPay]);

  const checkAgain = () => {
    if (!recheckId || checking) return;
    setChecking(true);
    void verifyHyperPay(recheckId, true).finally(() => setChecking(false));
  };

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);

    // ── HyperPay (Jordan) ──────────────────────────────────────────────────
    // HyperPay returns with `?id=<checkoutId>&resourcePath=…` appended to our
    // `?gateway=hyperpay`. Moyasar callbacks carry neither marker, so they fall
    // through to the original code below untouched.
    if (params.get('gateway') === 'hyperpay' || params.has('resourcePath')) {
      setIsHyperPay(true);

      // Already given a final answer in this tab — a refresh shows it again
      // rather than asking a second time. A `status=pending` marker (written
      // before FA-409) is not final, so that page asks again.
      const settledStatus = params.get('settled') === '1' ? hyperPayStatus(params.get('status')) : null;
      if (settledStatus && settledStatus !== 'pending') {
        showHyperPay(settledStatus, {
          rawStatus: params.get('status'),
          amount:  params.get('amount'),
          balance: params.get('balance'),
          brand:   params.get('brand'),
          last4:   params.get('last4'),
          message: params.get('message'),
        });
        return;
      }

      const checkoutId = hyperPayCheckoutId(params);
      if (!checkoutId) {
        setStatus('failed');
        return;
      }

      void verifyHyperPay(checkoutId, false);
      return;
    }

    const paymentId = params.get('id');
    const urlStatus = params.get('status');
    const urlMsg    = params.get('message');

    // Already answered: by the verify below in this tab, or by a saved-card
    // charge that settled server-side. Show that answer again and never verify
    // twice — a second verify could credit the wallet twice (FA-407).
    if (params.get('settled') === '1') {
      if (urlStatus === 'paid') {
        setAmount(params.get('amount'));
        setBalance(params.get('balance'));
        setStatus('success');
      } else if (urlStatus === 'failed') {
        setGatewayMsg(urlMsg);
        setStatus('failed');
      } else {
        setUncertain(params.get('uncertain') === '1');
        setStatus('pending');
      }
      return;
    }

    if (!paymentId) {
      setStatus('failed');
      return;
    }

    // Moyasar says it failed — show immediately, no verify needed
    if (urlStatus === 'failed') {
      if (urlMsg) setGatewayMsg(decodeURIComponent(urlMsg).replace(/\+/g, ' '));
      setStatus('failed');
      return;
    }

    // Verify with the backend — `metadata.transaction_id` links to the wallet
    // transaction. Once per payment in this tab: React's development
    // double-mount reuses the promise.
    let verification = moyasarVerifications.get(paymentId);
    if (!verification) {
      verification = walletApi.verifyTopUp(paymentId);
      moyasarVerifications.set(paymentId, verification);
    }

    verification
      .then((result) => {
        const s = result.status ?? '';
        let shown: 'paid' | 'failed' | 'pending';
        const shownAmount  = result.amount  != null ? String(result.amount)  : null;
        const shownBalance = result.balance != null ? String(result.balance) : null;
        if (s === 'completed' || s === 'paid' || s === 'captured') {
          shown = 'paid';
          setAmount(shownAmount);
          setBalance(shownBalance);
          setStatus('success');
        } else if (s === 'failed') {
          shown = 'failed';
          setStatus('failed');
        } else {
          // `pending`, `initiated`, `authorized`… or no status at all: not a
          // final answer, so never "failed" (FA-402).
          shown = 'pending';
          if (!result.status) {
            logger.warn('[payment-callback] Moyasar verify answered without a status; showing pending.');
            setUncertain(true);
          }
          setStatus('pending');
        }

        // Mark the URL as answered (FA-407), as the HyperPay branch does: a
        // refresh, or Back into this page, shows this answer instead of
        // verifying again.
        const marked = new URLSearchParams(params);
        marked.set('settled', '1');
        marked.set('status', shown);
        marked.delete('message');
        for (const [key, value] of Object.entries({
          amount:    shown === 'paid' ? shownAmount : null,
          balance:   shown === 'paid' ? shownBalance : null,
          uncertain: shown === 'pending' && !result.status ? '1' : null,
        })) {
          if (value) marked.set(key, value); else marked.delete(key);
        }
        window.history.replaceState(null, '', `${window.location.pathname}?${marked.toString()}`);
      })
      .catch((err) => {
        logger.error('[payment-callback] verifyTopUp error:', err);
        // No answer: the URL stays unmarked, so a refresh asks again.
        moyasarVerifications.delete(paymentId);
        // Same rule as HyperPay (isRefusal): only a refusal of the request is
        // "failed"; the network, a timeout or a 5xx is "check the ledger".
        if (isRefusal(err)) {
          setGatewayMsg(refusalMessage(err));
          setStatus('failed');
        } else {
          setUncertain(true);
          setStatus('pending');
        }
      });
  }, [showHyperPay, verifyHyperPay]);

  const goToDrivers = () => { window.location.href = '/drivers'; };
  const goToLedger  = () => { window.location.href = '/wallet'; };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-500" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">{t('paymentCallback.verifying')}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('paymentCallback.pleaseWait')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">{t('paymentCallback.successTitle')}</h2>
            {amount != null && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('paymentCallback.amountAdded', { amount: formatMoney(amount, locale) })}
              </p>
            )}
            {card && (
              <p className="mt-1 text-xs text-slate-400">
                {/* One left-to-right token, so Arabic keeps "Visa •••• 0010" in card order. */}
                {t('paymentCallback.paidWithCard', { card: ltrIsolate(`${card.brand} •••• ${card.last4}`) })}
              </p>
            )}
            {balance != null && (
              <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 dark:bg-emerald-500/10">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('paymentCallback.newBalance')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(balance, locale)}
                </p>
              </div>
            )}
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>
              {t('paymentCallback.backToDrivers')}
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10">
              <XCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">{t('paymentCallback.failedTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{gatewayMsg ?? t('paymentCallback.failedDefault')}</p>
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>{t('paymentCallback.backToDrivers')}</Button>
          </>
        )}

        {status === 'notCompleted' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <XCircle className="h-8 w-8 text-slate-500 dark:text-slate-400" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">{t('paymentCallback.notCompletedTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {expired ? t('paymentCallback.notCompletedExpiredBody') : t('paymentCallback.notCompletedBody')}
            </p>
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>{t('paymentCallback.backToDrivers')}</Button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">{t('paymentCallback.processingTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {uncertain
                ? t('paymentCallback.uncertainBody')
                : isHyperPay ? t('paymentCallback.confirmingBody') : t('paymentCallback.processingBody')}
            </p>
            {/* Never "try again" before the ledger says the money did not move. */}
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              {t('paymentCallback.checkLedgerFirst')}
            </p>
            {stillPending && !checking && (
              <p role="status" className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('paymentCallback.stillPending')}
              </p>
            )}
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>{t('paymentCallback.backToDrivers')}</Button>
            {/* HyperPay: ask the backend again — it may have the webhook's or
                reconciliation's answer by now (FA-409). */}
            {isHyperPay && recheckId && (
              <Button variant="secondary" className="mt-2 w-full" onClick={checkAgain} isLoading={checking}>
                {t('paymentCallback.checkAgain')}
              </Button>
            )}
            <Button variant="secondary" className="mt-2 w-full" onClick={goToLedger}>{t('paymentCallback.openLedger')}</Button>
          </>
        )}

      </div>
    </div>
  );
}
