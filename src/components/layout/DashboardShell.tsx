'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/store/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  // Protected route guard
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[rgb(var(--background))]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <Topbar title={title} subtitle={subtitle} />
        <div className="px-6 pb-8 pt-4 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
