'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { sendOtp, isLoading, error, isAuthenticated } = useAuthStore();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await sendOtp(phone);
    if (ok) router.push('/otp');
  };

  return (
    <div className="flex h-screen">
      {/* Left panel — gradient brand */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#180a5e] via-[#2d1b8e] to-[#1a3a7a]">
        {/* Decorative rings */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-1/4 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-20 top-1/4 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -left-20 bottom-[-60px] h-80 w-80 rounded-full border border-white/10" />
        </div>

        {/* Branding */}
        <div className="relative z-10 text-center text-white select-none">
          <p className="text-5xl font-black tracking-tight">
            <span className="font-black">My</span>
            <span className="font-light">Vego</span>
          </p>
          <p className="mt-3 text-sm font-medium text-white/60 tracking-widest uppercase">
            {t('auth.smartMobility')}
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center bg-gray-50 dark:bg-slate-900 px-6">
        {/* Controls */}
        <div className="absolute end-6 top-6 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          <div className="rounded-2xl bg-white dark:bg-slate-800 px-8 py-10 shadow-elevated">
            {/* Heading */}
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('auth.welcomeBack')}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('auth.enterPhoneOtp')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone input */}
              <div
                className="flex items-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all"
              >
                <div className="flex shrink-0 items-center gap-1.5 border-e border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-3.5">
                  <span className="text-base leading-none">🇸🇦</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">+966</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="5X XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  className="min-w-0 flex-1 bg-white dark:bg-slate-800 px-3 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                  required
                  autoComplete="tel"
                />
              </div>

              {error && (
                <p className="text-xs text-danger-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || phone.length < 9}
                className="w-full rounded-full bg-gradient-to-r from-brand-700 to-brand-500 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-800 hover:to-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('auth.sending') : t('auth.sendOtp')}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            {t('auth.poweredBy')}
          </p>
        </div>
      </div>
    </div>
  );
}
