'use client';

import dynamic from 'next/dynamic';
import type { SwappingStationMapProps } from './SwappingStationMapInner';

const SwappingStationMapInner = dynamic(() => import('./SwappingStationMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="animate-pulse overflow-hidden rounded-2xl border bg-slate-100 dark:bg-slate-800"
      style={{ height: 420, borderColor: 'rgb(var(--border))' }}
    />
  ),
});

export function SwappingStationMap(props: SwappingStationMapProps) {
  return <SwappingStationMapInner {...props} />;
}
