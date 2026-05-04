import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getColor(name: string) {
  const palette = [
    'from-indigo-500 to-violet-500',
    'from-emerald-500 to-teal-500',
    'from-sky-500 to-blue-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-fuchsia-500 to-purple-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
        getColor(name),
        sizeClasses[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
