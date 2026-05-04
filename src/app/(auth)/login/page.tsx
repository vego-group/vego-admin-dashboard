'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n/I18nProvider';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { signIn, isLoading, error, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('admin@myvego.com');
  const [password, setPassword] = useState('demo1234');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await signIn(email, password);
    if (ok) router.replace('/dashboard');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="absolute end-6 top-6 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div
          className="rounded-3xl border bg-white/80 p-8 shadow-elevated backdrop-blur-xl dark:bg-slate-900/70"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {t('auth.welcomeBack')}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t('auth.signInToContinue')}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('auth.email')}
              </label>
              <Input
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('auth.password')}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {t('auth.invalidCredentials')}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {t('auth.rememberMe')}
              </label>
              <a className="font-medium text-brand-600 hover:text-brand-700" href="#">
                {t('auth.forgotPassword')}
              </a>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              rightIcon={!isLoading && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            >
              {t('auth.signIn')}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          {t('auth.poweredBy')}
        </p>
      </div>
    </div>
  );
}
