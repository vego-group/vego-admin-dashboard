'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onChange }: PaginationProps) {
  const pages = Array.from({ length: Math.min(totalPages, 8) }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1.5 py-6" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800 rtl:rotate-180"
        style={{ borderColor: 'rgb(var(--border))' }}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onChange(page)}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all',
            page === currentPage
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          )}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800 rtl:rotate-180"
        style={{ borderColor: 'rgb(var(--border))' }}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
