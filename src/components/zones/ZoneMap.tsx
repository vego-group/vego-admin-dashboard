'use client';

import dynamic from 'next/dynamic';
import type { ZoneMapProps } from './ZoneMapInner';

export type { ZoneMapProps };

const ZoneMapInner = dynamic(() => import('./ZoneMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
      style={{ minHeight: 500 }}
    />
  ),
});

export function ZoneMap(props: ZoneMapProps) {
  return <ZoneMapInner {...props} />;
}
