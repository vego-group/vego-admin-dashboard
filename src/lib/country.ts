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
 * country switcher in this app.
 */

import type { CurrencyCode, DialCode, IsoCountryCode } from '@/types';

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

export interface SeededCountry {
  isoCountryCode: IsoCountryCode;
  dialCode: DialCode;
  nameEn: string;
  nameAr: string;
  currency: CurrencyCode;
  currencyDecimals: number;
}

/**
 * Offline seed for the two live countries.
 *
 * `GET /api/countries` (API root, no token) is authoritative once CR-1 wires it
 * up, but it must fall back to this both when the request fails AND when it
 * succeeds with an empty list — the shared environment currently returns zero
 * countries. That fallback is a warning, not an error.
 */
export const SEEDED_COUNTRIES: Record<string, SeededCountry> = {
  SA: {
    isoCountryCode: 'SA' as IsoCountryCode,
    dialCode: '+966' as DialCode,
    nameEn: 'Saudi Arabia',
    nameAr: 'السعودية',
    currency: 'SAR',
    currencyDecimals: 2,
  },
  JO: {
    isoCountryCode: 'JO' as IsoCountryCode,
    dialCode: '+962' as DialCode,
    nameEn: 'Jordan',
    nameAr: 'الأردن',
    currency: 'JOD',
    currencyDecimals: 3,
  },
};

/** Seeded currency for a country, when the fleet profile did not carry one. */
export function seededCurrencyFor(
  iso: IsoCountryCode | null | undefined,
): { currency: CurrencyCode; currencyDecimals: number } | undefined {
  if (!iso) return undefined;
  const seed = SEEDED_COUNTRIES[iso];
  return seed ? { currency: seed.currency, currencyDecimals: seed.currencyDecimals } : undefined;
}
