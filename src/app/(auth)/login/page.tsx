'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Phone, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useCountries } from '@/hooks/useCountries';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { flagEmoji, matchesPhoneRegex, toNationalNumber } from '@/lib/country';
import { cn } from '@/lib/cn';
import type { Country } from '@/types';

/** "Enter a valid Jordan mobile number (e.g. 791234567)" — built from the country's own facts. */
function invalidPhoneMessage(country: Country | undefined): string {
  if (!country) return 'Please enter a valid phone number';
  const hint = country.phoneExampleNational || country.phonePlaceholder;
  return hint
    ? `Enter a valid ${country.nameEn} mobile number (e.g. ${hint})`
    : `Enter a valid ${country.nameEn} mobile number`;
}

export default function LoginPage() {
  const router = useRouter();
  const { sendOtp, isLoading, isAuthenticated, error, clearError, loginCountry } = useAuthStore();
  const { countries, isLoading: countriesLoading } = useCountries();

  const [iso, setIso] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [countryError, setCountryError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

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
      setCountryError('Please select a country');
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
      <div className="flex w-full max-w-[880px] items-stretch gap-5">

        {/* ── Form card ─────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-3xl bg-white px-10 pb-8 pt-10 shadow-sm">
          <div className="flex-1">
            <h1 className="text-[28px] font-bold leading-snug text-slate-900">Welcome Back</h1>
            <p className="mt-2 text-base text-slate-500">
              Enter your phone number to sign in to your account
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              {/* Country */}
              <label htmlFor="login-country" className="mb-2 block text-sm font-semibold text-slate-700">
                Country
              </label>
              <div className="relative">
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
                    <option value="">Loading countries…</option>
                  ) : (
                    countries.map((c) => (
                      <option key={c.isoCountryCode} value={c.isoCountryCode}>
                        {flagEmoji(c.isoCountryCode)} {c.nameEn} ({c.dialCode})
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
                Phone Number
              </label>

              <div
                className={cn(
                  'flex overflow-hidden rounded-xl border transition-all focus-within:ring-2',
                  phoneError
                    ? 'border-rose-300 focus-within:ring-rose-400/20'
                    : 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-indigo-500/20'
                )}
              >
                <div className="flex shrink-0 items-center gap-2 border-e border-slate-200 bg-slate-50 px-4 py-4">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700" dir="ltr">
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
                  dir="ltr"
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
                    ? `Enter your ${maxDigits}-digit ${country.nameEn} mobile number`
                    : 'Select a country to continue'}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || !country}
                className="mt-6 w-full rounded-xl bg-indigo-500 py-4 text-base font-semibold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Sending...' : 'Continue →'}
              </button>

              {error && (
                <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-600">
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Secure badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Secure login with OTP verification
          </div>
        </div>

        <BrandPanel />
      </div>

      {/* Footer — outside both cards */}
      <p className="mt-5 text-center text-sm text-slate-400">
        By signing in, you agree to our{' '}
        <a href="https://www.vego.sa/en/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms of Service</a>
        {' '}and{' '}
        <a href="https://www.vego.sa/en/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>
      </p>
    </div>
  );
}
