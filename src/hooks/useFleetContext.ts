'use client';

/**
 * The fleet's own country and currency — the single source both are read from.
 *
 * Backed by `GET /fleet-admin/me`. Nothing in this app may derive a country from
 * a phone prefix, and nothing may assume SAR: a Jordanian fleet's balances are
 * JOD with three decimals, and formatting them as riyals is silently wrong.
 *
 * There is no default currency anywhere in this file. The currency is either
 * resolved, still loading, or unresolved — and each of those renders
 * differently. See {@link FleetCurrencyStatus}.
 *
 * The fleet's country is fixed on its fleet record. It is not selectable here —
 * the Fleet Admin realm rejects a `?country=` parameter with a 422.
 *
 * State lives in a module-level store rather than a React context so that every
 * caller shares one fetch without the tree needing a provider.
 */

import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { fleetAdminApi } from '@/lib/api';
import { isForbiddenError } from '@/lib/api-errors';
import { formatCurrency, PENDING_AMOUNT } from '@/lib/format';
import { logger } from '@/lib/logger';
import { onAccountChange, useAuthStore } from '@/store/auth';
import type { CurrencyCode, FleetProfile, IsoCountryCode, Locale } from '@/types';

/**
 * - `pending`    — the profile is still in flight. Money must not render at all;
 *                  a wrong currency for one frame is still a wrong currency.
 * - `resolved`   — currency and decimals are known.
 * - `unresolved` — the profile was fetched and we still do not know the currency.
 *                  Amounts render bare, with no unit and no assumed precision.
 */
export type FleetCurrencyStatus = 'pending' | 'resolved' | 'unresolved';

interface FleetStore {
  fleet: FleetProfile | null;
  isLoading: boolean;
  error: string | null;
  /** True once a fetch has completed, successfully or not. */
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  reset: () => void;
}

/**
 * Bumped by every reset. A profile request that was sent before the reset
 * belongs to the account that has just gone, and its answer is dropped.
 */
let generation = 0;

const useFleetStore = create<FleetStore>((set, get) => ({
  fleet: null,
  isLoading: false,
  error: null,
  loaded: false,

  load: async (force = false) => {
    const { isLoading, loaded } = get();
    if (isLoading || (loaded && !force)) return;
    // The endpoint is token-scoped: there is nothing to ask for before sign-in.
    if (!useAuthStore.getState().isAuthenticated) return;

    const requestedIn = generation;
    set({ isLoading: true, error: null });
    try {
      const fleet = await fleetAdminApi.getMe();
      if (requestedIn !== generation) return;
      set({ fleet, isLoading: false, loaded: true, error: null });
    } catch (err) {
      if (requestedIn !== generation) return;
      const message = err instanceof Error ? err.message : 'Could not load the fleet profile';
      if (isForbiddenError(err)) {
        // Signed in, but not as a fleet admin: the staff OTP login is shared, so
        // a superadmin gets this far, and every /fleet-admin/* call then answers
        // 403. Nothing here can work for that account — sign it out and let the
        // login page say why, rather than leave empty pages and dashes.
        logger.warn('[useFleetContext] GET /fleet-admin/me answered 403 — not a fleet admin account; signing out.');
        set({ fleet: null, isLoading: false, loaded: true, error: message });
        useAuthStore.getState().signOut('not_fleet_admin');
        return;
      }
      logger.warn(
        `[useFleetContext] GET /fleet-admin/me failed (${message}) — money will render ` +
        'without a currency unit until it succeeds.',
      );
      set({ fleet: null, isLoading: false, loaded: true, error: message });
    }
  },

  reset: () => {
    generation += 1;
    set({ fleet: null, isLoading: false, error: null, loaded: false });
  },
}));

// The profile is the signed-in account's: it is cleared at the session
// boundary, inside the auth store (FA-001). This used to happen in the hook's
// effect below, which never ran after a sign-out — the shell unmounts every
// page that uses the hook before the effect can see `isAuthenticated: false` —
// so the next account in the tab inherited this one's currency and decimals.
onAccountChange(() => useFleetStore.getState().reset());

export interface FleetContext {
  /** Full profile, or null until `/fleet-admin/me` resolves. */
  fleet: FleetProfile | null;
  /** ISO 3166-1 alpha-2 for the fleet's country; null until resolved. */
  isoCountryCode: IsoCountryCode | null;
  /** ISO 4217 code, or **null** whenever the currency is not known. */
  currency: CurrencyCode | null;
  /** Minor-unit exponent for `currency`, or **null** when not known. */
  currencyDecimals: number | null;
  /** Which of the three rendering states the currency is in. */
  currencyStatus: FleetCurrencyStatus;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the profile, ignoring the cached result. */
  refresh: () => Promise<void>;
  /**
   * Format an amount in the fleet's currency — the function components should
   * call. Defers to a neutral placeholder while the profile is loading, and
   * falls back to an unlabelled number if it could not be loaded at all.
   */
  formatMoney: (amount: string | number, locale?: Locale) => string;
}

export function useFleetContext(): FleetContext {
  const fleet     = useFleetStore((s) => s.fleet);
  const isLoading = useFleetStore((s) => s.isLoading);
  const error     = useFleetStore((s) => s.error);
  const loaded    = useFleetStore((s) => s.loaded);
  const load      = useFleetStore((s) => s.load);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Loading only. Clearing a signed-out account's profile is the auth store's
    // job — see `onAccountChange` above.
    if (isAuthenticated && !loaded) void load();
  }, [isAuthenticated, loaded, load]);

  // `loaded` without a fleet means we asked and still do not know. Anything else
  // short of a fleet is still in flight.
  const currencyStatus: FleetCurrencyStatus =
    fleet ? 'resolved' : loaded ? 'unresolved' : 'pending';

  const currency         = fleet?.currency ?? null;
  const currencyDecimals = fleet?.currencyDecimals ?? null;

  const formatMoney = useCallback(
    (amount: string | number, locale: Locale = 'en') =>
      currencyStatus === 'pending'
        ? PENDING_AMOUNT
        : formatCurrency(amount, currency, currencyDecimals, locale),
    [currencyStatus, currency, currencyDecimals],
  );

  return {
    fleet,
    isoCountryCode: fleet?.isoCountryCode ?? null,
    currency,
    currencyDecimals,
    currencyStatus,
    isLoading,
    error,
    refresh: () => load(true),
    formatMoney,
  };
}
