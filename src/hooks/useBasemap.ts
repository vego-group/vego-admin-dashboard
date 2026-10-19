'use client';

/**
 * The basemap tile layer of a Leaflet map, following the app's theme.
 *
 * A map adds it once, from its mount effect: `addBasemap(L, map)`. A theme
 * switch then re-points that same layer at the other style — no reload, no new
 * map, markers and zones untouched. On the OpenStreetMap fallback both themes
 * share one URL, so a switch fetches nothing: its dark look is the CSS filter on
 * `.map-tiles-fallback` (globals.css). Which tiles, and why: @/lib/map-tiles.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import { getMapTiles, type MapTheme } from '@/lib/map-tiles';

/** Marks the fallback's tile layer for its dark-mode filter in globals.css. */
const FALLBACK_CLASS = 'map-tiles-fallback';

/** The sliver of the Leaflet namespace this needs. */
interface TileLayerFactory {
  tileLayer(url: string, options: { attribution: string; maxZoom: number; className: string }): TileLayer;
}

export function useBasemap() {
  const { resolvedTheme } = useTheme();
  const theme: MapTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const themeRef = useRef(theme);
  const layerRef = useRef<TileLayer | null>(null);

  useEffect(() => {
    themeRef.current = theme;
    // An unchanged URL (the fallback) makes setUrl a no-op: no redraw.
    layerRef.current?.setUrl(getMapTiles(theme).url);
  }, [theme]);

  // Stable, so it can sit in a map's mount-once effect.
  return useCallback((L: TileLayerFactory, map: LeafletMap) => {
    const tiles = getMapTiles(themeRef.current);
    layerRef.current = L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      maxZoom: tiles.maxZoom,
      className: tiles.isFallback ? FALLBACK_CLASS : '',
    }).addTo(map);
  }, []);
}
