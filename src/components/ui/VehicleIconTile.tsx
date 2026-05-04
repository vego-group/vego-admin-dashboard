import { Bike } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VehicleStatus } from '@/types';

const tileColor: Record<VehicleStatus, string> = {
  active: 'bg-emerald-500',
  charging: 'bg-sky-500',
  idle: 'bg-slate-400',
  maintenance: 'bg-orange-500',
};

interface VehicleIconTileProps {
  status: VehicleStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function VehicleIconTile({ status, size = 'md', className }: VehicleIconTileProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center text-white shadow-sm',
        tileColor[status],
        sizeClasses[size],
        className
      )}
    >
      <Bike className={iconSizes[size]} />
    </div>
  );
}
