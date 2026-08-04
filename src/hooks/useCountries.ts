'use client';

/**
 * The country roster — which markets exist and what a phone number looks like
 * in each.
 *
 * Backed by `GET /countries`, which sits at the API root and needs no token
 * because the login screen renders a country picker before there is a session.
 *
 * State lives in a module-level store rather than a React context so that the
 * login page and the driver form share one fetch without the tree needing a
 * provider — and so the roster survives the navigation from /login to /otp.
 *
 * `countriesApi.list()` never rejects: an unreachable backend and an empty
 * successful response both resolve to the seeded SA/JO roster. There is
 * therefore no error state here — only "not loaded yet" and "loaded".
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { countriesApi } from '@/lib/api';
import { findCountry } from '@/lib/country';
import type { Country, IsoCountryCode } from '@/types';

interface CountriesStore {
  countries: Country[];
  isLoading: boolean;
  /** True once a fetch has completed — successfully or via the seeded fallback. */
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
}

const useCountriesStore = create<CountriesStore>((set, get) => ({
  countries: [],
  isLoading: false,
  loaded: false,

  load: async (force = false) => {
    const { isLoading, loaded } = get();
    if (isLoading || (loaded && !force)) return;

    set({ isLoading: true });
    const countries = await countriesApi.list();
    set({ countries, isLoading: false, loaded: true });
  },
}));

export interface CountriesContext {
  /** Every live market. Empty only while the first fetch is in flight. */
  countries: Country[];
  isLoading: boolean;
  loaded: boolean;
  /** The country for an ISO code, or undefined if it is not in the roster. */
  byIso: (iso: IsoCountryCode | null | undefined) => Country | undefined;
  refresh: () => Promise<void>;
}

export function useCountries(): CountriesContext {
  const countries = useCountriesStore((s) => s.countries);
  const isLoading = useCountriesStore((s) => s.isLoading);
  const loaded    = useCountriesStore((s) => s.loaded);
  const load      = useCountriesStore((s) => s.load);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return {
    countries,
    isLoading,
    loaded,
    byIso: (iso) => findCountry(countries, iso),
    refresh: () => load(true),
  };
}
