import type { Locale } from '@/types';

const localeMap: Record<Locale, string> = {
  en: 'en-US',
  ar: 'ar-SA',
};

export function formatNumber(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeMap[locale]).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale = 'en',
  currency = 'SAR'
): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** "5 min ago" / "منذ 5 دقائق" */
export function formatRelativeTime(iso: string, locale: Locale = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' });
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  return rtf.format(diffDay, 'day');
}
