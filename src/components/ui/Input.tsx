import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'h-11 w-full rounded-xl border bg-white text-sm text-slate-900 transition-colors',
            'placeholder:text-slate-400',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500',
            'disabled:cursor-not-allowed disabled:opacity-60',
            leftIcon ? 'ps-11' : 'ps-4',
            rightIcon ? 'pe-11' : 'pe-4',
            className
          )}
          style={{ borderColor: 'rgb(var(--border))' }}
          {...props}
        />
        {rightIcon && (
          <span className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
