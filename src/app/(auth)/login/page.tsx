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
    <div className="flex min-h-screen items-center justify-center bg-[#eeeef8] px-4 py-10">
      <div className="flex w-full max-w-[660px] items-stretch gap-5">

        {/* ── Form card ─────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-3xl bg-white px-8 pb-6 pt-8 shadow-sm">
          <div className="flex-1">
            <h1 className="text-[22px] font-bold leading-snug text-slate-900">Welcome Back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your phone number to sign in to your account
            </p>

            <form onSubmit={handleSubmit} className="mt-7">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
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
                <div className="flex shrink-0 items-center gap-2 border-e border-slate-200 bg-slate-50 px-3 py-3">
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
                  className="min-w-0 flex-1 bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  autoComplete="tel"
                />
              </div>

              {phoneError ? (
                <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {phoneError}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">
                  Enter your 9-digit Saudi mobile number
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Secure login with OTP verification
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-[11px] text-slate-400">
            By signing in, you agree to our{' '}
            <span className="cursor-pointer underline hover:text-slate-600">Terms of Service</span>
            {' '}and{' '}
            <span className="cursor-pointer underline hover:text-slate-600">Privacy Policy</span>
          </p>
        </div>

        <BrandPanel />
      </div>
    </div>
  );
}
