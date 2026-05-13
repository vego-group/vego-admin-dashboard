'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Drawer width — default 'md' (380px) */
  size?: 'sm' | 'md' | 'lg';
  /** Show backdrop blur. Default: true. Set false to keep the map interactive. */
  withBackdrop?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-80',
  md: 'w-[400px]',
  lg: 'w-[500px]',
};

export function Drawer({
  open,
  onClose,
  children,
  size = 'md',
  withBackdrop = true,
  className,
}: DrawerProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && withBackdrop && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          'fixed end-0 top-0 z-50 flex h-full flex-col bg-[rgb(var(--card))] shadow-elevated transition-transform duration-300 ease-out',
          'border-s',
          sizeClasses[size],
          open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
          className
        )}
        style={{ borderColor: 'rgb(var(--border))' }}
        role="dialog"
        aria-modal={withBackdrop}
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  );
}

/** Reusable drawer header with title, optional subtitle, and close button. */
export function DrawerHeader({
  title,
  subtitle,
  icon,
  onClose,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-6 py-5"
      style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="-me-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
