'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/store/auth';

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** When true, disables page scroll so content fills the viewport exactly (e.g. maps) */
  fullHeight?: boolean;
}

export function DashboardShell({ title, subtitle, children, fullHeight = false }: DashboardShellProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router   = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Close mobile sidebar whenever the route changes
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/login');
  }, [mounted, isAuthenticated, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[rgb(var(--background))]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[rgb(var(--background))]">
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuToggle={() => setSidebarOpen((p) => !p)}
        />
        <main className={fullHeight ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto overflow-x-hidden'}>
          <div className={fullHeight
            ? 'flex h-full flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-8'
            : 'px-4 pb-8 pt-4 sm:px-6 lg:px-8'
          }>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
