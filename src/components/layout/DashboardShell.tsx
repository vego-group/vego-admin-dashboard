'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** When true, disables page scroll so content fills the viewport exactly (e.g. maps) */
  fullHeight?: boolean;
}

export function DashboardShell({ title, subtitle, children, fullHeight = false }: DashboardShellProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Protected route guard — wait for Zustand to rehydrate from localStorage before redirecting
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, router]);

  // Show spinner while Zustand rehydrates from localStorage (avoids white flash)
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
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} subtitle={subtitle} />
        <main className={fullHeight ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto overflow-x-hidden'}>
          <div className={fullHeight ? 'flex h-full flex-col px-6 pb-4 pt-4 sm:px-8' : 'px-6 pb-8 pt-4 sm:px-8'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
