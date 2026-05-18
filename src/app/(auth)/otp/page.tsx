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
    <div className="flex min-h-screen items-center justify-center bg-[#eeeef8] px-4 py-10">
      <div className="flex w-full max-w-[660px] items-stretch gap-5">

        {/* ── OTP card ──────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-3xl bg-white px-8 pb-8 pt-6 shadow-sm">
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
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Verify Your Number</h1>
          <p className="mt-1.5 text-sm text-slate-500">Enter the 6-digit code sent to</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800" dir="ltr">
            +966 {pendingPhone ?? ''}
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <label className="mb-3 block text-sm font-semibold text-slate-700">
              Verification Code
            </label>

            {/* OTP digit boxes */}
            <div className="flex gap-2.5" onPaste={handlePaste}>
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
                    'h-14 w-full rounded-xl border bg-white text-center text-xl font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20',
                    digit ? 'border-indigo-400' : 'border-slate-200 focus:border-indigo-500'
                  )}
                  aria-label={`OTP digit ${i + 1}`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {error && (
              <p className="mt-2.5 text-center text-xs text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || otp.length < OTP_LENGTH}
              className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In →'}
            </button>

            {/* Resend */}
            <p className="mt-4 text-center text-sm text-slate-500">
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
    </div>
  );
}
