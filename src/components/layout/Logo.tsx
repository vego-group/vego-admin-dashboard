import Image from 'next/image';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  /** When true, renders just the icon mark without the wordmark */
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Brand mark — uses the PNG from /public */}
      <div className="relative h-9 w-9 shrink-0">
        <Image
          src="/myvego_logo_blue.png"
          alt="MyVego"
          fill
          sizes="36px"
          priority
          className="object-contain"
        />
      </div>

      {!iconOnly && (
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
            MyVego
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Fleet Management
          </span>
        </div>
      )}
    </div>
  );
}