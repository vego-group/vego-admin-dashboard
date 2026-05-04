import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'orange';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const toneClasses: Record<Tone, string> = {
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  danger:
    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  neutral:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand:
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  orange:
    'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
};

const dotColors: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
  brand: 'bg-indigo-500',
  orange: 'bg-orange-500',
};

export function Badge({ className, tone = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} />}
      {children}
    </span>
  );
}
