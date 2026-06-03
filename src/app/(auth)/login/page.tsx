'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { cn } from '@/lib/cn';

export default function LoginPage() {
  const router = useRouter();
  const { sendOtp, isLoading, isAuthenticated, error, clearError } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 9 || !phone.startsWith('5')) {
      setPhoneError('Please enter a valid Saudi phone number (5xxxxxxxx)');
      return;
    }
    const ok = await sendOtp(phone);
    if (ok) router.push('/otp');
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
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Phone Number
              </label>

              {/* Phone input */}
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
                  <span className="text-sm font-semibold text-slate-700">+966</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="5xxxxxxxx"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setPhone(val);
                    if (phoneError) setPhoneError('');
                    if (error) clearError();
                  }}
                  maxLength={9}
                  className="min-w-0 flex-1 bg-white px-4 py-4 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  autoComplete="tel"
                />
              </div>

              {phoneError ? (
                <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {phoneError}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Enter your 9-digit Saudi mobile number
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
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
