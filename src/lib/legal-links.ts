import type { Locale } from '@/types';

/**
 * VEGO's Terms of Service and Privacy Policy, in the UI language (FA-006).
 *
 * Both sign-in screens linked the English pages whatever the language. The
 * Arabic pages are the site's default locale, at the root (`/ar/…` redirects
 * there); the English ones are under `/en/`. Each URL was checked to answer
 * 200 with a page in its language (2026-11-06); an unknown path on the site
 * answers 404, so these are real pages.
 *
 * One set serves both markets: no Jordan-specific terms were found. If Legal
 * publishes per-country terms, key this by country as well.
 */
export const LEGAL_LINKS: Record<Locale, { terms: string; privacy: string }> = {
  en: {
    terms:   'https://www.vego.sa/en/terms-and-conditions',
    privacy: 'https://www.vego.sa/en/privacy-policy',
  },
  ar: {
    terms:   'https://www.vego.sa/terms-and-conditions',
    privacy: 'https://www.vego.sa/privacy-policy',
  },
};
