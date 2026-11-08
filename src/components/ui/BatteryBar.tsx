import { cn } from '@/lib/cn';

interface BatteryBarProps {
  /** 0–100, or nothing when not reported: an empty track, not a red 0. */
  value: number | null | undefined;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

function getColor(value: number) {
  if (value >= 60) return 'bg-emerald-500';
  if (value >= 30) return 'bg-amber-500';
  if (value === 0) return 'bg-rose-500';
  return 'bg-rose-500';
}

export function BatteryBar({ value, className, size = 'md' }: BatteryBarProps) {
  const known   = typeof value === 'number' && Number.isFinite(value);
  const clamped = known ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', known ? getColor(clamped) : 'bg-transparent')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
