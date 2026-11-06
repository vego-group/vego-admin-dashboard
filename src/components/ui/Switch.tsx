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
  // Whole class names, so Tailwind sees them. The `rtl:` halves mirror the
  // knob: in RTL the track starts on the right, and a positive translate
  // pushed the knob out of it (FA-222). This used an inline `transform` that
  // overrode the classes in both directions.
  const dimensions =
    size === 'sm'
      ? { track: 'h-4 w-7', thumb: 'h-3 w-3', on: 'translate-x-3 rtl:-translate-x-3' }
      : { track: 'h-5 w-9', thumb: 'h-4 w-4', on: 'translate-x-4 rtl:-translate-x-4' };

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
          checked ? dimensions.on : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}
