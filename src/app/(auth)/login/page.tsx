'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Clock, Phone, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AUTH_NETWORK_ERROR, useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { useCountries } from '@/hooks/useCountries';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { flagEmoji, matchesPhoneRegex, toNationalNumber } from '@/lib/country';
import { cn } from '@/lib/cn';
import { bidiIsolate, ltrIsolate } from '@/lib/format';
import type { Country } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const {
    sendOtp, isLoading, isAuthenticated, error, clearError, loginCountry, signOutReason, takeSignOutReason,
  } = useAuthStore();
  const { countries, isLoading: countriesLoading } = useCountries();
  const { t, locale } = useI18n();

  const [iso, setIso] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [countryError, setCountryError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // "Session expired" set before a full page load survives only in storage.
  useEffect(() => { takeSignOutReason(); }, [takeSignOutReason]);

  // Default to the market this operator last signed in to, then to the first in
  // the roster. Runs only while nothing is selected, so it never fights the user.
  useEffect(() => {
    if (iso || countries.length === 0) return;
    const remembered = countries.find((c) => c.isoCountryCode === loginCountry?.isoCountryCode);
    setIso(String(remembered?.isoCountryCode ?? countries[0].isoCountryCode));
  }, [iso, countries, loginCountry]);

  const country = useMemo(
    () => countries.find((c) => c.isoCountryCode === iso),
    [countries, iso],
  );

  const maxDigits = country?.nationalNumberLength || 15;

  const countryName = (c: Country): string => (locale === 'ar' && c.nameAr ? c.nameAr : c.nameEn);

  /** "Enter a valid Jordan mobile number (e.g. 791234567)" — built from the country's own facts. */
  const invalidPhoneMessage = (c: Country | undefined): string => {
    if (!c) return t('auth.invalidPhone');
    // The example number, never the mask: `phone_placeholder` ("5X XXX XXXX") is
    // what the input shows as a placeholder, and `phone_example` is the real
    // number behind this "e.g.". With no example, the message drops the hint
    // rather than offering a mask as something to type.
    const example = c.phoneExampleNational;
    return example
      ? t('drivers.phoneInvalidForCountry', { country: countryName(c), example })
      : t('drivers.phoneInvalidForCountryShort', { country: countryName(c) });
  };

  const handleCountryChange = (next: string) => {
    setIso(next);
    // The old number was validated against a different rule — re-check it rather
    // than leaving a stale error, or a stale pass, on screen.
    setPhoneError('');
    setCountryError('');
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!country) {
      setCountryError(t('auth.selectCountry'));
      return;
    }

    const national = toNationalNumber(phone, country.dialCode);
    if (!matchesPhoneRegex(national, country.phoneRegex)) {
      setPhoneError(invalidPhoneMessage(country));
      return;
    }

    const result = await sendOtp({
      phone: national,
      country: { isoCountryCode: country.isoCountryCode, dialCode: country.dialCode },
    });

    if (result.ok) {
      router.push('/otp');
      return;
    }

    // 422 country_not_supported / phone_invalid_for_country are input mistakes:
    // they belong on the field, not in the page banner, and they are never a
    // reason to sign anyone out.
    const fieldError = result.fieldError;
    if (!fieldError) return;

    const detail = fieldError.expectedFormat ?? fieldError.example;
    const message = detail ? `${fieldError.message} (${detail})` : fieldError.message;
    if (fieldError.field === 'country') setCountryError(message);
    else setPhoneError(message);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eeeef8] px-4 py-12">
      <div className="mb-4 flex w-full max-w-[880px] justify-end">
        <LanguageSwitcher alwaysLight />
      </div>

      <div className="flex w-full max-w-[880px] items-stretch gap-5">

        {/* ── Form card ─────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-3xl bg-white px-10 pb-8 pt-10 shadow-sm">
          <div className="flex-1">
            <h1 className="text-[28px] font-bold leading-snug text-slate-900">{t('auth.welcomeBack')}</h1>
            <p className="mt-2 text-base text-slate-500">
              {t('auth.loginSubtitle')}
            </p>

            {/* The app signed a non-fleet-admin account out (403 on /fleet-admin/me). */}
            {signOutReason === 'not_fleet_admin' && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-600"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('auth.noFleetAdminAccess')}</span>
              </div>
            )}

            {/* An API call answered 401: the token expired or was revoked. */}
            {signOutReason === 'session_expired' && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('auth.sessionExpired')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8">
              {/* Country */}
              <label htmlFor="login-country" className="mb-2 block text-sm font-semibold text-slate-700">
                {t('auth.country')}
              </label>
              {/* Left-to-right in both languages, like the phone field it sets
                  the dial code for: in Arabic, "🇯🇴 Jordan (+962)" otherwise
                  reorders to "Jordan (+962) JO". */}
              <div className="relative" dir="ltr">
                <select
                  id="login-country"
                  value={iso}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={countriesLoading && countries.length === 0}
                  className={cn(
                    'h-[54px] w-full appearance-none rounded-xl border bg-white pe-10 ps-4 text-sm text-slate-900 outline-none transition-all',
                    'focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
                    countryError
                      ? 'border-rose-300 focus:ring-rose-400/20'
                      : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20',
                  )}
                >
                  {countries.length === 0 ? (
                    <option value="">{t('auth.loadingCountries')}</option>
                  ) : (
                    countries.map((c) => (
                      // Both parts isolated: an Arabic name otherwise pulls the
                      // dial code into its own right-to-left run ("(962+) الأردن").
                      <option key={c.isoCountryCode} value={c.isoCountryCode}>
                        {flagEmoji(c.isoCountryCode)} {bidiIsolate(countryName(c))} ({ltrIsolate(c.dialCode)})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              {countryError && (
                <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {countryError}
                </div>
              )}

              {/* Phone */}
              <label htmlFor="login-phone" className="mb-2 mt-5 block text-sm font-semibold text-slate-700">
                {t('auth.phoneNumber')}
              </label>

              {/* Dial code then number, left to right, in both languages. */}
              <div
                dir="ltr"
                className={cn(
                  'flex overflow-hidden rounded-xl border transition-all focus-within:ring-2',
                  phoneError
                    ? 'border-rose-300 focus-within:ring-rose-400/20'
                    : 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-indigo-500/20'
                )}
              >
                <div className="flex shrink-0 items-center gap-2 border-e border-slate-200 bg-slate-50 px-4 py-4">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    {country?.dialCode ?? '—'}
                  </span>
                </div>
                <input
                  id="login-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder={country?.phonePlaceholder || ''}
                  value={phone}
                  onChange={(e) => {
                    // Paste-tolerant: a pasted "+962 79 123 4567" reduces to the
                    // national number rather than being truncated mid-prefix. The
                    // length cap lives here rather than in maxLength, which would
                    // clip the pasted text before it could be normalised.
                    setPhone(toNationalNumber(e.target.value, country?.dialCode).slice(0, maxDigits));
                    if (phoneError) setPhoneError('');
                    if (countryError) setCountryError('');
                    if (error) clearError();
                  }}
                  className="min-w-0 flex-1 bg-white px-4 py-4 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  autoComplete="tel-national"
                />
              </div>

              {phoneError ? (
                <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {phoneError}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  {country
                    ? t('auth.phoneDigitsHint', { digits: maxDigits, country: countryName(country) })
                    : t('auth.selectCountryToContinue')}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || !country}
                className="mt-6 w-full rounded-xl bg-indigo-500 py-4 text-base font-semibold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? t('auth.sending') : t('auth.continue')}
              </button>

              {error && (
                <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600">
                  {error === AUTH_NETWORK_ERROR ? t('auth.cannotConnect') : error}
                </div>
              )}
            </form>
          </div>

          {/* Secure badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('auth.secureLogin')}
          </div>
        </div>

        <BrandPanel />
      </div>

      {/* Footer — outside both cards */}
      <p className="mt-5 text-center text-sm text-slate-400">
        {t('auth.agreePrefix')}{' '}
        <a href="https://www.vego.sa/en/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">{t('auth.termsOfService')}</a>
        {t('auth.agreeJoin')}
        <a href="https://www.vego.sa/en/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">{t('auth.privacyPolicy')}</a>
      </p>
    </div>
  );
}
