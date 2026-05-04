'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bike,
  BatteryCharging,
  Users,
  Settings2,
  LineChart,
  LogOut,
} from 'lucide-react';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { href: '/fleet', icon: Bike, key: 'nav.fleet' },
  { href: '/stations', icon: BatteryCharging, key: 'nav.batteryStations' },
  { href: '/drivers', icon: Users, key: 'nav.drivers' },
  { href: '/vehicle-control', icon: Settings2, key: 'nav.vehicleControl' },
  { href: '/reports', icon: LineChart, key: 'nav.reports' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <aside
      className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-e bg-[rgb(var(--sidebar))] text-[rgb(var(--sidebar-foreground))]"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      {/* Brand */}
      <div className="px-5 pb-4 pt-6">
        <Logo />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
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
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign out */}
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
