'use client';

/**
 * What this fleet's country calls the machine a driver rides.
 *
 * The noun is **server-driven per country** — `vehicle_term: { ar, en }` on
 * `GET /countries` and on `country` in `GET /fleet-admin/me`. Saudi Arabia is
 * seeded `دباب`, Jordan `دراجة نارية`, and the next market will be something
 * else again. So no copy in this app may contain one of those words: every
 * string that names the vehicle is a parameterised key — `"ال{{vehicle}}"` —
 * and {@link useVehicleTerm} is what fills the placeholder in.
 *
 * Use `tv()` exactly where `t()` was used. It is `t()` with `{{vehicle}}` and
 * `{{vehicles}}` already bound, so a component never has to remember to pass
 * them, and a key that does not mention the vehicle is unaffected.
 */

import { useCallback, useMemo } from 'react';
import { useCountries } from '@/hooks/useCountries';
import { useFleetContext } from '@/hooks/useFleetContext';
import { NEUTRAL_VEHICLE_TERM, seededVehicleTermFor } from '@/lib/country';
import { useI18n } from '@/i18n/I18nProvider';
import type { Country, FleetProfile, Locale, VehicleTerm } from '@/types';

/**
 * The term to use, in priority order:
 *
 *   1. the fleet profile's own — `GET /fleet-admin/me` → `country.vehicle_term`
 *   2. the country roster's, for the fleet's country — `GET /countries`
 *   3. that country's seeded term
 *   4. {@link NEUTRAL_VEHICLE_TERM}
 *
 * Step 4 is a **generic** noun, never another country's word: a Jordanian
 * operator reading Saudi vocabulary is the exact defect this replaces, and it
 * would be worse than reading "vehicle".
 *
 * Exported so a non-React caller can resolve the same term the same way.
 */
export function resolveVehicleTerm(
  fleet: FleetProfile | null,
  country: Country | undefined,
): VehicleTerm {
  return (
    fleet?.vehicleTerm
    ?? country?.vehicleTerm
    ?? seededVehicleTermFor(fleet?.isoCountryCode)
  );
}

/**
 * The English plural of a term.
 *
 * Deliberately only applied to English. Arabic plurals are not derivable by
 * suffix — `دباب` and `دراجة نارية` pluralise differently — and the backend
 * sends only a singular, so the Arabic dictionary is written to need one. Any
 * Arabic string reaching for `{{vehicles}}` gets the singular back rather than
 * an invented word.
 */
function pluralise(term: string, locale: Locale): string {
  if (locale !== 'en' || !term) return term;
  if (/(?:s|x|z|ch|sh)$/i.test(term)) return `${term}es`;
  if (/[^aeiou]y$/i.test(term)) return `${term.slice(0, -1)}ies`;
  return `${term}s`;
}

/**
 * Title-case for the `{{Vehicle}}` form, which English headings need ("Motorcycle
 * Control", not "motorcycle Control"). The backend sends a lowercase noun.
 *
 * A no-op in Arabic, which has no letter case — so `{{Vehicle}}` and
 * `{{vehicle}}` resolve to the same word there and either is safe to write.
 */
function titleCase(term: string): string {
  return term ? term.charAt(0).toUpperCase() + term.slice(1) : term;
}

/**
 * The **definite** form of an Arabic term — `{{alVehicle}}`.
 *
 * Arabic marks definiteness with a prefixed `ال` on the noun *and* on every
 * adjective agreeing with it. Writing `"ال{{vehicle}}"` straight into the
 * dictionary is therefore only correct for a one-word term:
 *
 *     دباب        → الدباب           ✓
 *     دراجة نارية → الدراجة نارية    ✗ (should be الدراجة النارية)
 *
 * Jordan's seeded term is two words, so every Arabic screen would have carried
 * that error. The article is applied per word here instead, and the dictionary
 * uses `{{alVehicle}}` rather than gluing on its own `ال`.
 *
 * A word already carrying the article is left alone, so a backend that sends a
 * definite term does not end up doubly-prefixed.
 */
function definiteAr(term: string): string {
  return term
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.startsWith('ال') ? word : `ال${word}`))
    .join(' ');
}

/**
 * The definite form after the preposition `لِ` — `{{lilVehicle}}`.
 *
 * `ل` + `الدباب` is written `للدباب`, not `لالدباب`: the article's alef elides.
 * The dictionary cannot express that by concatenation either, so it gets its
 * own form. Only the first word takes the preposition.
 */
function lilFormAr(term: string): string {
  const [head, ...rest] = definiteAr(term).split(' ');
  if (!head) return term;
  return [`ل${head.replace(/^ا/, '')}`, ...rest].join(' ');
}

export interface VehicleTermContext {
  /** The singular noun in the active locale, e.g. 'دباب' | 'motorcycle'. */
  vehicle: string;
  /** The plural in the active locale. Equals `vehicle` in Arabic — see `pluralise`. */
  vehicles: string;
  /** Both languages, for copy that has to name one explicitly. */
  term: VehicleTerm;
  /** True while the fleet profile is still in flight and the term may change. */
  isLoading: boolean;
  /**
   * `t()` with all four forms pre-bound — `{{vehicle}}`, `{{vehicles}}`, and
   * their title-case `{{Vehicle}}` / `{{Vehicles}}`. An explicit param of the
   * same name still wins, so a key passing its own `vehicle` keeps its meaning.
   */
  tv: (key: string, params?: Record<string, string | number>) => string;
}

export function useVehicleTerm(): VehicleTermContext {
  const { t, locale } = useI18n();
  const { fleet, isoCountryCode, currencyStatus } = useFleetContext();
  const { byIso, loaded: countriesLoaded } = useCountries();

  const country = byIso(isoCountryCode);
  const term = useMemo(() => resolveVehicleTerm(fleet, country), [fleet, country]);

  // A term that resolved to an empty string still has to render as a word.
  const vehicle =
    (locale === 'ar' ? term.ar : term.en)
    || (locale === 'ar' ? NEUTRAL_VEHICLE_TERM.ar : NEUTRAL_VEHICLE_TERM.en);
  const vehicles = useMemo(() => pluralise(vehicle, locale), [vehicle, locale]);

  const tv = useCallback<VehicleTermContext['tv']>(
    (key, params) =>
      t(key, {
        vehicle,
        vehicles,
        Vehicle:  titleCase(vehicle),
        Vehicles: titleCase(vehicles),
        // Arabic-only forms. In English they fall back to the bare term so a
        // key that reached the English dictionary never prints Arabic
        // morphology; English copy writes its own "the".
        alVehicle:  locale === 'ar' ? definiteAr(vehicle) : vehicle,
        lilVehicle: locale === 'ar' ? lilFormAr(vehicle)  : vehicle,
        ...params,
      }),
    [t, locale, vehicle, vehicles],
  );

  return {
    vehicle,
    vehicles,
    term,
    isLoading: currencyStatus === 'pending' || !countriesLoaded,
    tv,
  };
}
