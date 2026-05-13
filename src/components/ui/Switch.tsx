'use client';

import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export function Switch({ checked, onChange, disabled, size = 'md', ...rest }: SwitchProps) {
  const dimensions =
    size === 'sm'
      ? { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' }
      : { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-60',
        dimensions.track,
        checked
          ? 'bg-brand-600'
          : 'bg-slate-200 dark:bg-slate-700'
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow-sm transition-transform',
          dimensions.thumb,
          checked ? dimensions.translate : 'translate-x-0.5',
          'rtl:[&]:!translate-x-0' // base position for RTL
        )}
        style={
          checked
            ? { transform: `translateX(${size === 'sm' ? '0.75rem' : '1rem'})` }
            : { transform: 'translateX(0.125rem)' }
        }
      />
    </button>
  );
}
