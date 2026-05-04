'use client';

import { cn } from '@/lib/cn';

interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'panel';
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  variant = 'pill',
}: SegmentedControlProps<T>) {
  const isPanel = variant === 'panel';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full p-1',
        isPanel
          ? 'border bg-white dark:bg-slate-900/40'
          : 'bg-slate-100 dark:bg-slate-800/60',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
      style={isPanel ? { borderColor: 'rgb(var(--border))' } : undefined}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition-all',
              size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2',
              active
                ? 'bg-brand-950 text-white shadow-sm dark:bg-brand-600'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
