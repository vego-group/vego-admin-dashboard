'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, Clock, CreditCard, Loader2, Shield } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/format';
import {
  clearHyperPayCheckout,
  isCheckoutExpired,
  mountHyperPayWidget,
  readHyperPayCheckout,
  unmountHyperPayWidget,
  type StoredHyperPayCheckout,
} from '@/lib/hyperpay';
import { logger } from '@/lib/logger';
import type { Locale } from '@/types';

/** How long the widget may take to render before the page gives up on it. */
const WIDGET_READY_TIMEOUT_MS = 30_000;

/**
 * `/wallet/top-up/pay?checkout=<checkoutId>` — HyperPay COPYandPAY for a
 * Jordanian top-up.
 *
 * The modal stored the checkout in sessionStorage and navigated here; this page
 * only renders the widget. Paying sends the whole page to 3-D Secure and then
 * to `/payment-callback?gateway=hyperpay`, which verifies. "Back" leaves
 * without verifying anything.
 */
export default function HyperPayPaymentPage() {
  const { t } = useI18n();
  return (
    <DashboardShell title={t('wallet.payPageTitle')} subtitle={t('wallet.payPageSubtitle')}>
      <HyperPayPayment />
    </DashboardShell>
  );
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'expired' }
  | { kind: 'ready'; checkout: StoredHyperPayCheckout };

function HyperPayPayment() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  // Read the checkout the modal left for us. Missing or past `expires_at` means
  // there is nothing to pay with.
  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get('checkout') ?? '';
    const checkout = checkoutId ? readHyperPayCheckout(checkoutId) : null;
    if (!checkout || isCheckoutExpired(checkout.expiresAt)) {
      if (checkoutId) clearHyperPayCheckout(checkoutId);
      setState({ kind: 'expired' });
      return;
    }
    try {
      if (new URL(checkout.shopperResultUrl).origin !== window.location.origin) {
        // The admin is signed in on this origin only; the callback page there
        // will not have their session to verify with.
        logger.warn(
          `[HyperPay] Payment returns to ${checkout.shopperResultUrl}, not to this origin ` +
          `(${window.location.origin}). Verification there needs a session on that host.`,
        );
      }
    } catch {
      // Already validated as an https URL by the API layer.
    }
    setState({ kind: 'ready', checkout });
  }, []);

  // A checkout that runs out while the page is open is dead too.
  const expiresAt = state.kind === 'ready' ? state.checkout.expiresAt : null;
  useEffect(() => {
    if (!expiresAt) return;
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms)) return;
    const timer = window.setTimeout(() => setState({ kind: 'expired' }), Math.min(Math.max(0, ms), 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  const checkout = state.kind === 'ready' ? state.checkout : null;

  const goBack = () => {
    // Abandoned: the next top-up starts a fresh checkout.
    if (checkout) clearHyperPayCheckout(checkout.checkoutId);
    router.push(checkout?.returnTo ?? '/drivers');
  };

  return (
    <div className="mx-auto max-w-xl">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={goBack}
        leftIcon={<ChevronLeft className="h-4 w-4 rtl:rotate-180" />}
        className="mb-3"
      >
        {t('common.back')}
      </Button>

      <Card className="overflow-hidden">
        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {state.kind === 'expired' && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <Clock className="h-7 w-7 text-amber-500" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">{t('wallet.payPageExpiredTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('wallet.payPageExpiredBody')}</p>
            <Button type="button" variant="primary" className="mt-6" onClick={goBack}>
              {t('common.back')}
            </Button>
          </div>
        )}

        {checkout && (
          <>
            {/* What is being paid — in the checkout's own currency and decimals. */}
            <div
              className="flex items-start justify-between gap-4 border-b px-6 py-5"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('wallet.payPageAmount')}</p>
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {formatCurrency(checkout.amount, checkout.currency, checkout.decimals, locale)}
                  </p>
                  {checkout.driverName && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {t('wallet.payPageForDriver', { name: checkout.driverName })}
                    </p>
                  )}
                </div>
              </div>
              {checkout.mode === 'test' && (
                <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {t('wallet.payPageTestMode')}
                </span>
              )}
            </div>

            <div className="px-6 py-5">
              {checkout.tokenizationEnabled && (
                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t('wallet.payPageSavedCardsNote')}</p>
              )}
              {/* Re-keyed on the language: a switch tears the widget down and
                  renders it again in the new locale, with the same checkout. */}
              <HyperPayWidget
                key={`${checkout.checkoutId}:${locale}`}
                checkout={checkout}
                locale={locale}
                onExpired={() => {
                  clearHyperPayCheckout(checkout.checkoutId);
                  setState({ kind: 'expired' });
                }}
              />
            </div>

            <div
              className="flex items-center justify-center gap-2 border-t bg-slate-50/50 px-6 py-3 text-xs text-slate-500 dark:bg-slate-900/30 dark:text-slate-400"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {/* The gateway is known here — `initiate` said hyperpay. */}
              <span>{t('drivers.encryptedPaymentBy', { gateway: 'HyperPay' })}</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

interface HyperPayWidgetProps {
  checkout: StoredHyperPayCheckout;
  locale: Locale;
  onExpired: () => void;
}

/**
 * The COPYandPAY widget, mounted once per checkout and language.
 *
 * Unmounting tears it down completely (`wpwl.unload()`, its scripts, its DOM,
 * `window.wpwl` and `window.wpwlOptions`), so a second top-up in the same tab
 * starts clean.
 */
function HyperPayWidget({ checkout, locale, onExpired }: HyperPayWidgetProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ready = false;
    const fail = () => { if (!ready) setStatus('failed'); };
    const giveUp = window.setTimeout(fail, WIDGET_READY_TIMEOUT_MS);

    // Deferred by a tick so that React's development double-mount runs its
    // cleanup before anything is injected — the script goes in exactly once.
    const inject = window.setTimeout(() => {
      mountHyperPayWidget(
        container,
        checkout,
        {
          // Required by HyperPay so 3-D Secure takes the whole page.
          paymentTarget: '_top',
          locale: locale === 'ar' ? 'ar' : 'en',
          style: 'card',
          // HyperPay: its number formatter does not support right-to-left
          // languages, and should be off when the locale is "ar".
          ...(locale === 'ar' ? { numberFormatting: false } : {}),
          // Only the placeholders inside the card-number and CVV iframes can be
          // styled. Slate-500, like the card-holder placeholder in globals.css:
          // readable on the widget's white fields in both themes.
          iframeStyles: {
            'card-number-placeholder': { color: '#64748b', 'font-size': '14px' },
            'cvv-placeholder':         { color: '#64748b', 'font-size': '14px' },
          },
          onReady: () => {
            ready = true;
            window.clearTimeout(giveUp);
            setStatus('ready');
          },
          onError: (error) => {
            logger.warn('[HyperPay] widget error:', error?.name, error?.message);
            if (error?.name === 'InvalidCheckoutIdError') onExpiredRef.current();
            else fail();
          },
        },
        () => {
          // Blocked by CSP, an SRI mismatch, or the network.
          logger.error('[HyperPay] widget script failed to load:', checkout.widgetScriptUrl);
          fail();
        },
      );
    }, 0);

    return () => {
      window.clearTimeout(inject);
      window.clearTimeout(giveUp);
      unmountHyperPayWidget(container, checkout.widgetScriptUrl);
    };
  }, [checkout, locale]);

  return (
    <>
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('wallet.payPageLoading')}
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('wallet.payPageLoadFailed')}</span>
        </div>
      )}
      {/* COPYandPAY renders into this element; React never touches its children. */}
      <div ref={containerRef} className="hyperpay-widget" hidden={status === 'failed'} />
    </>
  );
}
