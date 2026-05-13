'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function OtpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { verifyOtp, sendOtp, isLoading, error, isAuthenticated, pendingPhone } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // Redirect back if no pending phone
  useEffect(() => {
    if (!pendingPhone) router.replace('/login');
  }, [pendingPhone, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
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
    const otp = digits.join('');
    const ok = await verifyOtp(otp);
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
  const maskedPhone = pendingPhone
    ? pendingPhone.slice(0, 2) + '*'.repeat(Math.max(0, pendingPhone.length - 4)) + pendingPhone.slice(-2)
    : '';

  return (
    <div className="flex h-screen">
      {/* Left panel — gradient brand */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#180a5e] via-[#2d1b8e] to-[#1a3a7a]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-1/4 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-20 top-1/4 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -left-20 bottom-[-60px] h-80 w-80 rounded-full border border-white/10" />
        </div>
        <div className="relative z-10 text-center text-white select-none">
          <p className="text-5xl font-black tracking-tight">
            <span className="font-black">My</span>
            <span className="font-light">Vego</span>
          </p>
          <p className="mt-3 text-sm font-medium text-white/60 tracking-widest uppercase">
            Smart Mobility Management System
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center bg-gray-50 dark:bg-slate-900 px-6">
        <div className="absolute end-6 top-6 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="rounded-2xl bg-white dark:bg-slate-800 px-8 py-10 shadow-elevated">
            {/* Heading */}
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('auth.enterOtp')}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('auth.otpSentTo')}{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300 ltr:direction-ltr" dir="ltr">
                  +966 {maskedPhone}
                </span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* OTP digit boxes */}
              <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
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
                    className="h-12 w-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-lg font-bold text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    aria-label={`OTP digit ${i + 1}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {error && (
                <p className="text-center text-xs text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length < OTP_LENGTH}
                className="w-full rounded-full bg-gradient-to-r from-brand-700 to-brand-500 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-800 hover:to-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('auth.verifying') : t('auth.verifyOtp')}
              </button>

              {/* Resend */}
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    {t('auth.resendOtp')}
                  </button>
                ) : (
                  t('auth.resendIn').replace('{{seconds}}', String(countdown))
                )}
              </p>
            </form>
          </div>

          {/* Back link */}
          <p className="mt-4 text-center text-sm text-slate-400">
            <button
              type="button"
              onClick={() => router.back()}
              className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              ← Change number
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
