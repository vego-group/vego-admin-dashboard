import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Providers } from '@/components/providers/Providers';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MyVego — Fleet Management',
  description: 'Real-time electric moped fleet monitoring and analytics',
  icons: {
    icon: '/myvego_logo_blue.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} ${ibmPlexArabic.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
