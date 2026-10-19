import { logger } from '@/lib/logger';
import { fractionDigitsOf, parseAmount, toMinorUnits } from '@/lib/money';
import type { CurrencyCode, Locale } from '@/types';

/**
 * Arabic keeps its own words, currency labels (`د.أ.`, `ر.س.`) and RTL layout,
 * but Latin digits (`-u-nu-latn`). With Arabic-Indic digits and the Arabic
 * decimal separator a JOD amount reads `٩٥٫٠٠٠ د.أ.` — easily taken for 95,000 —
 * and a lone `٠` in a stat card looks like a dot. Latin digits also match what
 * the amount field accepts.
 */
const localeMap: Record<Locale, string> = {
  en: 'en-US',
  ar: 'ar-SA-u-nu-latn',
};

/**
 * Stands in for an amount whose currency has not been resolved yet.
 *
 * Money is the one thing that must never render optimistically: a JOD balance
 * shown for even one frame as "SAR 120.50" is wrong, and nothing on screen says
 * so. Waiting is the only safe default.
 */
export const PENDING_AMOUNT = '—';

export function formatNumber(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeMap[locale]).format(value);
}

/**
 * Render an amount with no currency unit and no assumed precision — exactly the
 * digits the value already carries, with locale grouping.
 *
 * This is what an unresolved currency looks like: an honestly unlabelled number
 * rather than a number wearing the wrong label.
 */
function formatUnlabelledAmount(amount: string | number, locale: Locale): string {
  const text = typeof amount === 'number'
    ? (Number.isFinite(amount) ? String(amount) : '0')
    : String(amount).trim();

  const digits = fractionDigitsOf(text);
  const value  = toMinorUnits(text, digits) / 10 ** digits;
  if (!Number.isFinite(value)) return text;

  return new Intl.NumberFormat(localeMap[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// ── Dev-only diagnostics ─────────────────────────────────────────────────────
//
// Every call site that trips this is one that renders money before the fleet
// profile has resolved, i.e. one that still needs the loading treatment.

const warnedCallSites = new Set<string>();

/**
 * Best-effort name of the React component that called us. Dev builds only —
 * production minifies these frames into uselessness, which is why the warning is
 * gated on NODE_ENV rather than merely being quiet in production.
 */
function callerName(): string {
  const frames = new Error().stack?.split('\n').slice(1) ?? [];
  // Skip this module and the fleet hook that wraps it.
  const internal = /[\\/](?:format|money)\.ts|useFleetContext/;
  // PascalCase names that are runtime plumbing rather than components.
  const notAComponent = /^(?:Object|Module|Function|Array|Promise|Error|HTML\w*)$/;

  for (const frame of frames) {
    if (internal.test(frame)) continue;
    // React components are PascalCase by convention.
    const named = /at\s+(?:async\s+)?([A-Z][A-Za-z0-9_$]*)/.exec(frame);
    if (named && !notAComponent.test(named[1])) return named[1];
  }
  // No recognisable component frame — the raw frame still points at a file:line.
  return frames.find((f) => !internal.test(f))?.trim() ?? 'an unknown call site';
}

function warnUnresolvedCurrency(): void {
  if (process.env.NODE_ENV === 'production') return;

  const caller = callerName();
  if (warnedCallSites.has(caller)) return;   // once per call site, not per render
  warnedCallSites.add(caller);

  logger.warn(
    `[formatCurrency] ${caller} rendered a money value while the fleet's currency ` +
    'was unresolved — the amount is shown without a currency unit. This call site ' +
    'needs the loading treatment (see useFleetContext().currencyStatus).',
  );
}

/**
 * Format a fixed-precision amount in the fleet's own currency.
 *
 * `currency` and `decimals` come from `useFleetContext()`. Passing **null** for
 * either means the fleet profile has not resolved, and the amount is rendered
 * bare — no symbol, no code, no assumed decimal count. There is deliberately no
 * SAR default: assuming a currency is precisely the bug this module exists to
 * prevent.
 *
 * Components should normally call `useFleetContext().formatMoney()`, which also
 * defers while the profile is still loading.
 *
 * Amounts arrive as backend decimal strings ("120.500") and are parsed
 * digit-wise, never with parseFloat.
 */
export function formatCurrency(
  amount: string | number,
  currency: CurrencyCode | null,
  decimals: number | null,
  locale: Locale = 'en',
): string {
  if (currency == null || decimals == null) {
    warnUnresolvedCurrency();
    return formatUnlabelledAmount(amount, locale);
  }

  const value = parseAmount(amount, decimals);

  // Intl throws a RangeError on anything that is not a well-formed ISO 4217
  // code; degrade to a plain number with the code alongside rather than
  // taking the page down with it.
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    const num = new Intl.NumberFormat(localeMap[locale], {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    return currency ? `${num} ${currency}` : num;
  }

  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Wrap a value of unknown direction — a raw backend key, a name — in Unicode
 * first-strong isolates, so it cannot reorder the translated text around it.
 * Without this an Arabic label such as "أخرى ({{value}})" can lose its closing
 * parenthesis to the wrong side when the value ends in punctuation.
 */
export function bidiIsolate(value: string): string {
  return `⁨${value}⁩`;
}

/**
 * Wrap a left-to-right token — a phone number, a plate, a masked card number —
 * in a left-to-right isolate, for when it is interpolated into a translated
 * sentence. In Arabic, "+962780009005" otherwise renders as "962780009005+",
 * and "Visa •••• 0010" as "0010 •••• Visa". In JSX, wrap the token in
 * `<span dir="ltr">` instead.
 */
export function ltrIsolate(value: string): string {
  return `\u2066${value}\u2069`;
}

export function formatPercent(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** "5 min ago" / "منذ 5 دقائق" */
export function formatRelativeTime(iso: string, locale: Locale = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' });
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  return rtf.format(diffDay, 'day');
}
