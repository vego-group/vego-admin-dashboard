'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? (theme === 'system' ? resolvedTheme : theme) === 'dark' : false;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white text-slate-600 transition-colors hover:bg-slate-50',
        'dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800',
        className
      )}
      style={{ borderColor: 'rgb(var(--border))' }}
      aria-label="Toggle theme"
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
