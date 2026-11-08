'use client';

import { Menu, User as UserIcon } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/auth';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMenuToggle: () => void;
}

export function Topbar({ title, subtitle, onMenuToggle }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  // The server's name for the signed-in account, or nothing. This fell back
  // to a made-up "John Doe" (FA-005).
  const name = user?.name?.trim() ?? '';
  // Only fleet-admin accounts stay signed in: /fleet-admin/me answers 403 for
  // any other and the app signs it out. So the role is known, and is said in
  // the UI language rather than as a hard-coded English "Fleet Manager".
  const roleLabel = t('common.roleFleetAdmin');

  return (
    <header
      className="sticky top-0 z-30 flex items-start justify-between gap-2 border-b bg-[rgb(var(--background))] px-4 pb-2 pt-4 sm:gap-4 sm:px-6 sm:pt-6 lg:px-8"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          style={{ borderColor: 'rgb(var(--border))' }}
          aria-label={t('common.toggleNavigation')}
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl lg:text-[28px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <LanguageSwitcher />
        <ThemeToggle />

        <div
          className="flex items-center gap-2 rounded-full border bg-white py-1 ps-1 pe-3 dark:bg-slate-900/40 sm:gap-3 sm:pe-4"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          {name ? (
            <Avatar name={name} size="md" />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              aria-hidden
            >
              <UserIcon className="h-4 w-4" />
            </span>
          )}
          <div className="hidden flex-col leading-tight sm:flex">
            {name && (
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {name}
              </span>
            )}
            <span
              className={name
                ? 'text-[11px] text-slate-500 dark:text-slate-400'
                : 'text-sm font-semibold text-slate-900 dark:text-slate-100'}
            >
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
