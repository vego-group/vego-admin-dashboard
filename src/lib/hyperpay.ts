/**
 * HyperPay COPYandPAY (Jordan) — the browser side.
 *
 * The dashboard never holds a HyperPay credential. It only ever sees what our
 * backend returns from `initiate`: a checkout id, the SRI hash, the widget
 * script URL (test or live host, chosen server-side) and the return URL. The
 * HyperPay host is never written into this app; it is read from that URL.
 *
 * The widget redirects the whole page for 3-D Secure and is not built for
 * React re-mounts, so it lives on its own page (`/wallet/top-up/pay`). The
 * checkout travels there through sessionStorage, keyed by checkout id.
 */

import { fractionDigitsOf, toMinorUnits } from '@/lib/money';
import type { HyperPayCheckout } from '@/types';

// ── The checkout, between the modal and the payment page ────────────────────

const CHECKOUT_KEY_PREFIX = 'myvego.hyperpay.checkout.';

/** What the payment page needs beyond the checkout itself. */
export interface StoredHyperPayCheckout extends HyperPayCheckout {
  driverName: string | null;
  /** Where "Back" goes — the page the top-up started on. */
  returnTo: string;
}

export function storeHyperPayCheckout(checkout: StoredHyperPayCheckout): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY_PREFIX + checkout.checkoutId, JSON.stringify(checkout));
  } catch {
    // Storage full or disabled: the payment page will say the session expired.
  }
}

export function readHyperPayCheckout(checkoutId: string): StoredHyperPayCheckout | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY_PREFIX + checkoutId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredHyperPayCheckout>;
    // Anything the widget cannot load without makes the entry useless.
    if (
      parsed?.checkoutId !== checkoutId
      || typeof parsed.widgetScriptUrl !== 'string'
      || typeof parsed.integrity !== 'string'
      || typeof parsed.shopperResultUrl !== 'string'
    ) {
      return null;
    }
    return {
      ...parsed,
      brands:   Array.isArray(parsed.brands) ? parsed.brands : ['VISA', 'MASTER'],
      // Only an explicit "saved" lists the stored cards; anything else is a new card.
      cardChoice: parsed.cardChoice === 'saved' ? 'saved' : 'new',
      returnTo: typeof parsed.returnTo === 'string' && parsed.returnTo.startsWith('/') ? parsed.returnTo : '/drivers',
    } as StoredHyperPayCheckout;
  } catch {
    return null;
  }
}

export function clearHyperPayCheckout(checkoutId: string): void {
  try {
    sessionStorage.removeItem(CHECKOUT_KEY_PREFIX + checkoutId);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** True once `expiresAt` has passed. An unreadable timestamp is not treated as expired. */
export function isCheckoutExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at <= now;
}

// ── HyperPay's amount rules ─────────────────────────────────────────────────
//
// The test server's whole-amounts rule is not checked here. It only applies in
// test, the backend enforces it itself (`422 amount_whole_only_in_test`, shown
// on the field), and live takes two decimals. The `mode` hint this app used to
// remember in localStorage (`myvego.hyperpay.hints`) only fed that rule; an old
// stored value is ignored.

/**
 * Which HyperPay amount rule an entered amount breaks, if any — the same code
 * the backend answers with. HyperPay takes at most two decimals (our JOD
 * wallet has three): 7.50 passes, 7.505 does not.
 */
export function hyperPayAmountIssue(amount: string): 'amount_precision' | null {
  const digits = Math.max(2, fractionDigitsOf(amount));
  const minor  = toMinorUnits(amount, digits);
  if (minor % 10 ** (digits - 2) !== 0) return 'amount_precision';
  return null;
}

// ── The widget itself ────────────────────────────────────────────────────────

/** The parts of COPYandPAY's global this app touches. */
interface Wpwl {
  unload?: () => void;
}

export interface WpwlError {
  name?: string;
  message?: string;
}

/** The `wpwlOptions` this app sets. See HyperPay's widget API reference. */
export interface WpwlOptions {
  paymentTarget?: string;
  locale?: string;
  style?: string;
  numberFormatting?: boolean;
  iframeStyles?: Record<string, Record<string, string>>;
  /** Stored cards. Merged into the widget's defaults, so only what is set here changes. */
  registrations?: { requireCvv?: boolean };
  /** Removes "Show other payment methods" under the stored cards. Top-level, not under `registrations`. */
  hideOtherPaymentButton?: boolean;
  onReady?: () => void;
  onError?: (error: WpwlError) => void;
}

declare global {
  interface Window {
    wpwl?: Wpwl;
    wpwlOptions?: WpwlOptions;
  }
}

const WIDGET_SCRIPT_MARK = 'data-hyperpay-widget';

/**
 * Inject the COPYandPAY form and script into `container`.
 *
 * `window.wpwlOptions` is set **before** the script goes in. HyperPay's own
 * snippet puts it right after the script tag, which in a static page still runs
 * before the widget initialises; here the script is injected into a page that
 * has already loaded and may initialise at once, so the options come first.
 */
export function mountHyperPayWidget(
  container: HTMLElement,
  checkout: Pick<HyperPayCheckout, 'widgetScriptUrl' | 'integrity' | 'shopperResultUrl' | 'brands'>,
  options: WpwlOptions,
  onScriptError: () => void,
): void {
  unmountHyperPayWidget(container, checkout.widgetScriptUrl);

  window.wpwlOptions = options;

  // Built imperatively: COPYandPAY rewrites this form, which React must never
  // try to reconcile.
  const form = document.createElement('form');
  form.action = checkout.shopperResultUrl;
  form.className = 'paymentWidgets';
  form.setAttribute('data-brands', checkout.brands.join(' '));
  container.appendChild(form);

  const script = document.createElement('script');
  script.src = checkout.widgetScriptUrl;
  script.integrity = checkout.integrity;
  script.crossOrigin = 'anonymous';
  script.async = true;
  script.setAttribute(WIDGET_SCRIPT_MARK, '');
  script.onerror = onScriptError;
  document.body.appendChild(script);
}

/**
 * Tear the widget down so the next top-up in this tab starts clean.
 *
 * HyperPay's guidance for single-page apps: removing the form is not enough —
 * call `wpwl.unload()` to drop its event bindings and iframe messaging, and
 * remove the `static.min.js` it loaded. Everything else it injected came from
 * the widget script's own host, which is read from the script URL rather than
 * written here.
 */
export function unmountHyperPayWidget(container: HTMLElement | null, widgetScriptUrl: string): void {
  try {
    window.wpwl?.unload?.();
  } catch {
    // A half-initialised widget may throw on unload; the DOM cleanup below still runs.
  }

  let widgetOrigin: string | null = null;
  try {
    widgetOrigin = new URL(widgetScriptUrl).origin;
  } catch {
    widgetOrigin = null;
  }

  const fromWidgetHost = (url: string | null) =>
    !!url && (url.includes('static.min.js') || url.includes('paymentWidgets.js')
      || (widgetOrigin !== null && url.startsWith(widgetOrigin)));

  document.querySelectorAll<HTMLScriptElement>(`script[${WIDGET_SCRIPT_MARK}], script[src]`).forEach((s) => {
    if (s.hasAttribute(WIDGET_SCRIPT_MARK) || fromWidgetHost(s.getAttribute('src'))) s.remove();
  });
  document.querySelectorAll<HTMLLinkElement>('link[href]').forEach((l) => {
    if (fromWidgetHost(l.getAttribute('href'))) l.remove();
  });
  // Anything the widget hung off <body> rather than off our form.
  document.querySelectorAll<HTMLElement>('body > [class*="wpwl-"]').forEach((el) => el.remove());

  if (container) container.innerHTML = '';

  delete window.wpwl;
  delete window.wpwlOptions;
}
