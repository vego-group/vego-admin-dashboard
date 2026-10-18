'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { brandLabel } from '@/components/wallet/SavedCardsList';
import { walletApi, type HyperPayVerifyResult } from '@/lib/api';
import { ApiError } from '@/lib/api/client';
import { clearHyperPayCheckout } from '@/lib/hyperpay';
import { useFleetContext } from '@/hooks/useFleetContext';
import { useI18n } from '@/i18n/I18nProvider';
import { logger } from '@/lib/logger';

type Status = 'loading' | 'success' | 'failed' | 'pending';

/**
 * One verify per HyperPay checkout, shared by every mount in this tab.
 *
 * HyperPay allows a single status check per payment. The backend already
 * guarantees that (a repeat verify returns its stored result), but this page
 * still asks only once: React's development double-mount reuses the promise,
 * and a refresh after the answer is caught by the `settled=1` marker below.
 */
const hyperPayVerifications = new Map<string, Promise<HyperPayVerifyResult>>();

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

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);

    // ── HyperPay (Jordan) ──────────────────────────────────────────────────
    // HyperPay returns with `?id=<checkoutId>&resourcePath=…` appended to our
    // `?gateway=hyperpay`. Moyasar callbacks carry neither marker, so they fall
    // through to the original code below untouched.
    if (params.get('gateway') === 'hyperpay' || params.has('resourcePath')) {
      setIsHyperPay(true);

      const show = (s: Status, r: {
        amount?: string | null; balance?: string | null;
        brand?: string | null; last4?: string | null; message?: string | null;
      }) => {
        setAmount(r.amount ?? null);
        setBalance(r.balance ?? null);
        setCard(s === 'success' && r.brand && r.last4 ? { brand: r.brand, last4: r.last4 } : null);
        setGatewayMsg(s === 'failed' ? r.message ?? null : null);
        setStatus(s);
      };

      // Already verified in this tab — a refresh shows the answer again rather
      // than asking a second time.
      if (params.get('settled') === '1') {
        const s = params.get('status');
        show(s === 'completed' ? 'success' : s === 'failed' ? 'failed' : 'pending', {
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

      let verification = hyperPayVerifications.get(checkoutId);
      if (!verification) {
        // Send only the id; the backend builds HyperPay's status URL itself.
        verification = walletApi.verifyHyperPayTopUp(checkoutId);
        hyperPayVerifications.set(checkoutId, verification);
      }

      verification
        .then((result) => {
          const s: Status =
            result.status === 'completed' ? 'success'
            : result.status === 'failed'  ? 'failed'
            : 'pending';
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
          show(s, shown);

          // Mark the URL as answered, like the saved-card `settled=1` hand-off.
          const marked = new URLSearchParams(params);
          marked.set('settled', '1');
          marked.set('status', result.status === 'completed' || result.status === 'failed' ? result.status : 'pending');
          for (const [key, value] of Object.entries(shown)) {
            if (value) marked.set(key, value); else marked.delete(key);
          }
          window.history.replaceState(null, '', `${window.location.pathname}?${marked.toString()}`);
          clearHyperPayCheckout(checkoutId);
        })
        .catch((err) => {
          logger.error('[payment-callback] HyperPay verify error:', err);
          hyperPayVerifications.delete(checkoutId);
          // A refusal of the request itself (unknown checkout, bad input) is a
          // failure. Anything else — the network, a 5xx, an expired session —
          // says nothing about the payment, which the webhook and the
          // reconciliation job still settle; claiming "failed" there invites
          // the admin to pay twice. The URL stays unmarked so a refresh asks again.
          const refused = err instanceof ApiError && err.status >= 400 && err.status < 500
            && err.status !== 401 && err.status !== 408 && err.status !== 429;
          if (refused) show('failed', { message: err.message && !/^HTTP \d{3}$/.test(err.message) ? err.message : null });
          else show('pending', {});
        });
      return;
    }

    const paymentId = params.get('id');
    const urlStatus = params.get('status');
    const urlMsg    = params.get('message');

    // Saved-card direct charge already settled server-side (wallet credited).
    // Show the result straight away — re-verifying would risk a double credit.
    if (params.get('settled') === '1' && urlStatus === 'paid') {
      setAmount(params.get('amount'));
      setBalance(params.get('balance'));
      setStatus('success');
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

    // Verify with the backend — `metadata.transaction_id` links to the wallet transaction
    walletApi.verifyTopUp(paymentId)
      .then((result) => {
        const s = (result.status ?? '').toLowerCase();
        if (s === 'completed' || s === 'paid' || s === 'captured') {
          setAmount(result.amount  != null ? String(result.amount)  : null);
          setBalance(result.balance != null ? String(result.balance) : null);
          setStatus('success');
        } else if (s === 'failed') {
          setStatus('failed');
        } else {
          setStatus('pending');
        }
      })
      .catch((err) => {
        logger.error('[payment-callback] verifyTopUp error:', err);
        setStatus('failed');
      });
  }, []);

  const goToDrivers = () => { window.location.href = '/drivers'; };

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
                {t('paymentCallback.paidWithCard', { brand: card.brand, last4: card.last4 })}
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

        {status === 'pending' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">{t('paymentCallback.processingTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isHyperPay ? t('paymentCallback.confirmingBody') : t('paymentCallback.processingBody')}
            </p>
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>{t('paymentCallback.backToDrivers')}</Button>
          </>
        )}

      </div>
    </div>
  );
}
