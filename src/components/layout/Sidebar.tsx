'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bike,
  BatteryCharging,
  Users,
  Settings2,
  LineChart,
  Map,
  Bell,
  LogOut,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard',        icon: LayoutDashboard, key: 'nav.dashboard' },
  { href: '/fleet',            icon: Bike,            key: 'nav.fleet' },
  { href: '/battery-swapping', icon: BatteryCharging, key: 'nav.batterySwapping' },
  { href: '/fast-charging',    icon: Zap,             key: 'nav.fastCharging' },
  { href: '/drivers',          icon: Users,           key: 'nav.drivers' },
  { href: '/vehicle-control',  icon: Settings2,       key: 'nav.vehicleControl' },
  { href: '/zones',            icon: Map,             key: 'nav.zones' },
  { href: '/notifications',    icon: Bell,            key: 'nav.notifications', showBadge: true },
  { href: '/reports',          icon: LineChart,       key: 'nav.reports' },
  { href: '/wallet',           icon: Wallet,          key: 'nav.wallet' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const unreadCount        = useNotificationStore((s) => s.unreadCount);
  const fetchUnreadCount   = useNotificationStore((s) => s.fetchUnreadCount);

  // Fetch unread count once on mount so the sidebar badge is always live,
  // even before the user visits the Notifications page.
  useEffect(() => { void fetchUnreadCount(); }, [fetchUnreadCount]);

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'flex w-[260px] shrink-0 flex-col border-e bg-[rgb(var(--sidebar))] text-[rgb(var(--sidebar-foreground))]',
        // Mobile: fixed overlay
        'fixed inset-y-0 start-0 z-50 transition-transform duration-300 ease-in-out',
        // Desktop: back into the flex layout, always visible
        'md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0',
        // Mobile-ONLY slide: max-md: ensures these never apply on desktop
        !isOpen && 'max-md:ltr:-translate-x-full max-md:rtl:translate-x-full'
      )}
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      {/* Header: logo + mobile close button */}
      <div className="flex items-center justify-between px-5 pb-4 pt-6">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            const badge = item.showBadge && unreadCount > 0 ? unreadCount : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-brand-950 text-white shadow-sm dark:bg-brand-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="truncate">{t(item.key)}</span>
                  {badge !== null && (
                    <span className="ms-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 text-sm font-semibold text-white shadow-sm transition-all hover:from-rose-600 hover:to-red-600 hover:shadow-md active:scale-[0.99]"
        >
          {t('common.signOut')}
          <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </button>
      </div>
    </aside>
  );
}
