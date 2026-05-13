'use client';

import dynamic from 'next/dynamic';
import type { LiveFleetMapProps } from './LiveFleetMapInner';

// Leaflet must be loaded client-side only (it reads window/document)
const LiveFleetMapInner = dynamic(() => import('./LiveFleetMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="animate-pulse overflow-hidden rounded-2xl border bg-slate-100 dark:bg-slate-800"
      style={{ height: 380, borderColor: 'rgb(var(--border))' }}
    />
  ),
});

export function LiveFleetMap(props: LiveFleetMapProps) {
  return <LiveFleetMapInner {...props} />;
}
