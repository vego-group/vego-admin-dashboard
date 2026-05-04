import { cn } from '@/lib/cn';

interface BatteryBarProps {
  value: number;
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
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', getColor(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
