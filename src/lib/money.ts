/**
 * Fixed-precision money.
 *
 * The backend sends money as an object, never a bare float:
 *
 *   { "balance": "120.500", "currency": "JOD", "minor_units": 120500, "decimals": 3 }
 *
 * The old `*_sar` aliases are deprecated (removed 2026-11-01) and are wrong by
 * construction outside Saudi Arabia — in Jordan the value is JOD while the key
 * says SAR. Nothing in this app may read them.
 *
 * Every conversion below routes through **integer minor units**. `parseFloat` is
 * deliberately never used: it turns "120.500" into a binary float whose error
 * shows up as soon as amounts are summed, and JOD's third decimal makes that
 * visible in a single transaction rather than after a thousand.
 */

import type { CurrencyCode, Money } from '@/types';

/**
 * Minor-unit exponent for the two live currencies. A fast path only — the
 * backend's own `decimals` / `currency_decimals` always wins, and Intl covers
 * everything else.
 */
const KNOWN_DECIMALS: Record<string, number> = {
  SAR: 2,
  JOD: 3,
};

/**
 * Minor-unit exponent for an ISO 4217 code, or **undefined** when the currency
 * is unknown or absent.
 *
 * There is deliberately no numeric default: returning 2 for an unrecognised
 * currency is the same class of bug as assuming SAR. Callers that genuinely
 * cannot defer fall back to the precision the value itself carries — see
 * {@link fractionDigitsOf}.
 */
export function decimalsForCurrency(currency?: string | null): number | undefined {
  if (!currency) return undefined;

  const code = currency.toUpperCase();
  const known = KNOWN_DECIMALS[code];
  if (known !== undefined) return known;

  // Intl carries the real ISO 4217 minor-unit table (JPY 0, JOD 3, …), so this
  // is a lookup rather than a guess. It throws on malformed codes.
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code })
      .resolvedOptions().minimumFractionDigits;
  } catch {
    return undefined;
  }
}

/** How many fraction digits a raw amount actually carries. Assumes nothing. */
export function fractionDigitsOf(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const text = typeof raw === 'number'
    ? (Number.isFinite(raw) ? String(raw) : '0')
    : String(raw).trim();
  const match = /^[+-]?\d*(?:[.,](\d*))?$/.exec(text);
  return match?.[1]?.length ?? 0;
}

/**
 * Exact integer minor units for a fixed-precision amount.
 *
 * Strings are split on the decimal point and recombined as digits, so no binary
 * float ever holds the value. Numbers are normalised through `toFixed` first —
 * they have already lost precision, but at least they round predictably.
 */
export function toMinorUnits(raw: string | number, decimals: number): number {
  const text = typeof raw === 'number'
    ? (Number.isFinite(raw) ? raw.toFixed(decimals) : '0')
    : String(raw).trim();

  const match = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(text);
  if (!match || (!match[2] && !match[3])) return 0;

  const sign  = match[1] === '-' ? -1 : 1;
  const whole = match[2] || '0';
  // The backend sends exactly `decimals` fraction digits, so truncating any
  // extras is lossless in practice and never rounds a total upward.
  const frac  = (match[3] ?? '').slice(0, decimals).padEnd(decimals, '0');

  const combined = Number(`${whole}${frac}`);
  return Number.isFinite(combined) ? sign * combined : 0;
}

/** Render integer minor units back as an exact decimal string ("120.500"). */
export function fromMinorUnits(minorUnits: number, decimals: number): string {
  const rounded = Math.round(minorUnits);
  const sign    = rounded < 0 ? '-' : '';
  const digits  = String(Math.abs(rounded)).padStart(decimals + 1, '0');
  if (decimals === 0) return `${sign}${digits}`;
  const cut = digits.length - decimals;
  return `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/**
 * Decimal value of a fixed-precision amount, for the numeric fields the UI still
 * holds. Goes through minor units — never `parseFloat`.
 */
export function parseAmount(
  raw: string | number | null | undefined,
  decimals: number,
): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  return toMinorUnits(raw, decimals) / 10 ** decimals;
}

/** The money object as the backend serialises it. `amount` or `balance`, never both. */
export interface ApiMoneyFields {
  amount?: string | number | null;
  balance?: string | number | null;
  currency?: string | null;
  minor_units?: number | null;
  decimals?: number | null;
}

/**
 * Normalise a backend money object into {@link Money}.
 *
 * `minor_units` is preferred when present because it is already exact; the
 * decimal string is the fallback and is parsed digit-wise.
 *
 * `fallback` covers responses that still send a bare scalar alongside the object
 * (e.g. the driver list's flat `wallet_balance`).
 */
export function readMoney(
  source: ApiMoneyFields | null | undefined,
  fallback?: { amount?: string | number | null; currency?: string | null },
): Money {
  const currency = source?.currency ?? fallback?.currency ?? null;
  const raw      = source?.amount ?? source?.balance ?? fallback?.amount ?? null;
  // Backend `decimals` first, then the currency's real minor-unit count, and
  // only then the precision the value itself carries. Never a hardcoded 2.
  const decimals = source?.decimals ?? decimalsForCurrency(currency) ?? fractionDigitsOf(raw);

  const minorUnits =
    typeof source?.minor_units === 'number' && Number.isFinite(source.minor_units)
      ? Math.round(source.minor_units)
      : toMinorUnits(raw ?? 0, decimals);

  return {
    amount: fromMinorUnits(minorUnits, decimals),
    minorUnits,
    currency: (currency as CurrencyCode | null) ?? null,
    decimals,
  };
}

/** Decimal value of a {@link Money}. Prefer `minorUnits` for any arithmetic. */
export function moneyToNumber(money: Money): number {
  return money.minorUnits / 10 ** money.decimals;
}

/** Smallest step an amount input may take, e.g. 0.01 for SAR, 0.001 for JOD. */
export function amountStep(decimals: number): number {
  return 1 / 10 ** decimals;
}
