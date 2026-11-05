'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFleetContext } from '@/hooks/useFleetContext';
import { countryView, type MapView } from '@/lib/map-fit';

/** The sliver of a Leaflet map this needs. */
interface ViewableMap {
  setView(center: [number, number], zoom: number, options?: { animate?: boolean }): unknown;
}

/**
 * The placeholder viewport of a map that has nothing to frame yet: the fleet's
 * own country, not Riyadh for everyone (FA-314).
 *
 * Returns a ref holding the view to open the map on, so the map's one-time
 * init effect can read it without depending on it. If the fleet profile
 * resolves after the map opened, the map moves to the country **once**, and
 * only while it has not framed real data (`hasFittedRef`) and is not `paused`
 * (the zones map pauses while the operator is drawing).
 */
export function useCountryViewport(
  mapRef: MutableRefObject<ViewableMap | null>,
  mapReady: boolean,
  hasFittedRef: MutableRefObject<boolean>,
  zoom: number,
  paused = false,
): MutableRefObject<MapView> {
  const { isoCountryCode } = useFleetContext();
  const viewRef = useRef<MapView>(countryView(isoCountryCode, zoom));
  viewRef.current = countryView(isoCountryCode, zoom);
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || paused || !isoCountryCode) return;
    if (hasFittedRef.current || appliedRef.current === isoCountryCode) return;
    appliedRef.current = isoCountryCode;
    const { center, zoom: z } = countryView(isoCountryCode, zoom);
    map.setView(center, z, { animate: false });
  }, [mapRef, mapReady, hasFittedRef, isoCountryCode, zoom, paused]);

  return viewRef;
}
