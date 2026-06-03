'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { cn } from '@/lib/cn';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function OtpPage() {
  const router = useRouter();
  const { verifyOtp, sendOtp, isLoading, error, isAuthenticated, pendingPhone } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!pendingPhone) router.replace('/login');
  }, [pendingPhone, router]);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyOtp(digits.join(''));
    if (ok) router.replace('/dashboard');
  };

  const handleResend = useCallback(async () => {
    if (!pendingPhone || !canResend) return;
    setCountdown(RESEND_COUNTDOWN);
    setCanResend(false);
    setDigits(Array(OTP_LENGTH).fill(''));
    await sendOtp(pendingPhone);
    inputRefs.current[0]?.focus();
  }, [pendingPhone, canResend, sendOtp]);

  const otp = digits.join('');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eeeef8] px-4 py-12">
      <div className="flex w-full max-w-[880px] items-stretch gap-5">

        {/* ── OTP card ──────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-3xl bg-white px-10 pb-10 pt-8 shadow-sm">
          {/* Back link */}
          <button
            type="button"
            onClick={() => router.back()}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {/* Heading */}
          <h1 className="mt-6 text-[28px] font-bold text-slate-900">Verify Your Number</h1>
          <p className="mt-2 text-base text-slate-500">Enter the 6-digit code sent to</p>
          <p className="mt-0.5 text-base font-semibold text-slate-800" dir="ltr">
            +966 {pendingPhone ?? ''}
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Verification Code
            </label>

            {/* OTP digit boxes */}
            <div className="flex gap-3" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target.value, i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  className={cn(
                    'h-16 w-full rounded-xl border bg-white text-center text-2xl font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20',
                    digit ? 'border-indigo-400' : 'border-slate-200 focus:border-indigo-500'
                  )}
                  aria-label={`OTP digit ${i + 1}`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || otp.length < OTP_LENGTH}
              className="mt-7 w-full rounded-xl bg-indigo-500 py-4 text-base font-semibold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In →'}
            </button>

            {/* Resend */}
            <p className="mt-5 text-center text-sm text-slate-500">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-50"
              >
                {canResend ? 'Resend Code' : `Resend Code (${countdown}s)`}
              </button>
            </p>
          </form>
        </div>

        <BrandPanel />
      </div>

      {/* Footer */}
      <p className="mt-5 text-center text-sm text-slate-400">
        By signing in, you agree to our{' '}
        <a href="https://www.vego.sa/en/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms of Service</a>
        {' '}and{' '}
        <a href="https://www.vego.sa/en/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>
      </p>
    </div>
  );
}
