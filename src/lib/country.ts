/**
 * Country primitives.
 *
 * The backend keeps two distinct fields on a user and they are NOT the same
 * thing, despite both being called a "code":
 *
 *   country_code      "+966"   dial prefix — display only
 *   iso_country_code  "SA"     ISO 3166-1 alpha-2 — resolves the country
 *
 * `DialCode` and `IsoCountryCode` are branded in @/types so the compiler rejects
 * passing one where the other belongs. These constructors are the only way to
 * mint them, and they reject cross-use at runtime too: `toIsoCountryCode('+966')`
 * and `toDialCode('SA')` both return undefined.
 *
 * A fleet's country is fixed on its fleet record. The Fleet Admin realm rejects
 * any `?country=` parameter with a 422 — never send one, and never offer a
 * country switcher in this app. (The login screen is the one exception: there is
 * no fleet yet, so the operator picks which market they are signing in to.)
 *
 * This module also owns every phone-shape decision. There is deliberately no
 * regex for a mobile number anywhere else in the app: the rule belongs to the
 * country, comes from `GET /countries`, and is applied through
 * {@link matchesPhoneRegex}.
 */

import { logger } from '@/lib/logger';
import type { Country, CurrencyCode, DialCode, IsoCountryCode } from '@/types';

/** Coerce a raw API `country_code` into a dial prefix. */
export function toDialCode(raw: string | number | null | undefined): DialCode | undefined {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits ? (`+${digits}` as DialCode) : undefined;
}

/** Coerce a raw API `iso_country_code` into an ISO 3166-1 alpha-2 code. */
export function toIsoCountryCode(raw: string | null | undefined): IsoCountryCode | undefined {
  const code = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? (code as IsoCountryCode) : undefined;
}

/**
 * Offline seed for the two live countries.
 *
 * `GET /countries` (API root, no token) is authoritative, but it must fall back
 * to this both when the request fails AND when it succeeds with an empty list —
 * the shared environment currently returns zero countries. That fallback is a
 * warning, not an error.
 *
 * The phone facts here mirror the seeder's, so an offline login is validated by
 * the same rules the backend would have applied.
 */
export const SEEDED_COUNTRIES: Record<string, Country> = {
  SA: {
    isoCountryCode: 'SA' as IsoCountryCode,
    dialCode: '+966' as DialCode,
    nameEn: 'Saudi Arabia',
    nameAr: 'السعودية',
    currency: 'SAR',
    currencyDecimals: 2,
    phoneRegex: '^5[0-9]{8}$',
    phonePlaceholder: '5X XXX XXXX',
    phoneExampleNational: '512345678',
    nationalNumberLength: 9,
  },
  JO: {
    isoCountryCode: 'JO' as IsoCountryCode,
    dialCode: '+962' as DialCode,
    nameEn: 'Jordan',
    nameAr: 'الأردن',
    currency: 'JOD',
    currencyDecimals: 3,
    phoneRegex: '^7[789][0-9]{7}$',
    phonePlaceholder: '7X XXX XXXX',
    phoneExampleNational: '791234567',
    nationalNumberLength: 9,
  },
};

/** The seed as an ordered list — the fallback country roster. */
export function seededCountries(): Country[] {
  return Object.values(SEEDED_COUNTRIES);
}

/** Seeded currency for a country, when the fleet profile did not carry one. */
export function seededCurrencyFor(
  iso: IsoCountryCode | null | undefined,
): { currency: CurrencyCode; currencyDecimals: number } | undefined {
  if (!iso) return undefined;
  const seed = SEEDED_COUNTRIES[iso];
  return seed?.currency && seed.currencyDecimals !== undefined
    ? { currency: seed.currency, currencyDecimals: seed.currencyDecimals }
    : undefined;
}

/** Find a country by ISO code in a roster. */
export function findCountry(
  countries: Country[],
  iso: IsoCountryCode | null | undefined,
): Country | undefined {
  if (!iso) return undefined;
  return countries.find((c) => c.isoCountryCode === iso);
}

/** 🇸🇦 / 🇯🇴 — the regional-indicator pair for an ISO alpha-2 code. */
export function flagEmoji(iso: IsoCountryCode | null | undefined): string {
  const code = String(iso ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

// ── Phone numbers ────────────────────────────────────────────────────────────

function onlyDigits(raw: string | number | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Drop a single trunk prefix `0` — "0791234567" is the same number as "791234567". */
function stripTrunkPrefix(digits: string): string {
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

/**
 * Reduce any of the shapes a phone number arrives in to the **national** number
 * — the digits `phone_regex` is written against.
 *
 * Handles, for a dial code of +962: `+962791234567`, `00962791234567`,
 * `962791234567`, `0791234567`, `791234567`, and the same five for +966. Spaces,
 * dashes and parentheses are ignored throughout.
 *
 * With no `dialCode` supplied — an old record whose country was never
 * recorded — every seeded dial code is tried instead, which is why a stored
 * `+966…` still normalises correctly when the fleet profile has not resolved.
 */
export function toNationalNumber(
  raw: string | number | null | undefined,
  dialCode?: DialCode | null,
): string {
  const digits = onlyDigits(raw);
  if (!digits) return '';

  const candidates = dialCode
    ? [onlyDigits(dialCode)]
    : seededCountries().map((c) => onlyDigits(c.dialCode));

  for (const dial of candidates) {
    if (!dial) continue;
    // "00" + dial first: "00962…" also starts with neither "962" nor a bare 0.
    if (digits.startsWith(`00${dial}`) && digits.length > dial.length + 2) {
      return stripTrunkPrefix(digits.slice(dial.length + 2));
    }
    if (digits.startsWith(dial) && digits.length > dial.length) {
      return stripTrunkPrefix(digits.slice(dial.length));
    }
  }

  return stripTrunkPrefix(digits);
}

/**
 * Full E.164 for a number in a country, e.g. '+962791234567'.
 *
 * Normalises first, so passing an already-prefixed number never double-prefixes.
 * Returns '' when there are no digits to send — callers must not post an empty
 * phone dressed up as a dial code.
 */
export function toE164(
  raw: string | number | null | undefined,
  dialCode: DialCode | null | undefined,
): string {
  const national = toNationalNumber(raw, dialCode);
  if (!national) return '';
  return dialCode ? `${dialCode}${national}` : national;
}

// Server-supplied patterns are compiled once. These fields validate on every
// keystroke, and the pattern is a constant for the life of the page.
const regexCache = new Map<string, RegExp | null>();

function compilePhoneRegex(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;

  let compiled: RegExp | null;
  try {
    compiled = new RegExp(pattern);
  } catch {
    logger.warn(
      `[country] GET /countries returned a phone_regex that is not a valid ` +
      `JavaScript regular expression (${pattern}) — the field will accept any ` +
      'non-empty number and let the backend reject it.',
    );
    compiled = null;
  }
  regexCache.set(pattern, compiled);
  return compiled;
}

/**
 * Does a national number satisfy its country's rule?
 *
 * A missing or unparseable pattern accepts any non-empty number: the backend
 * still validates, and blocking the operator on a rule we failed to load would
 * be worse than letting the 422 come back as a field error.
 */
export function matchesPhoneRegex(
  national: string,
  pattern: string | null | undefined,
): boolean {
  const value = national.trim();
  if (!value) return false;
  if (!pattern) return true;

  const regex = compilePhoneRegex(pattern);
  return regex ? regex.test(value) : true;
}
