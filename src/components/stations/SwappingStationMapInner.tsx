'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { fitToPoints, type LatLngTuple } from '@/lib/map-fit';
import { html, trustedHtml, type TrustedHtml } from '@/lib/html';
import { sharePercent } from '@/lib/format';
import { useI18n } from '@/i18n/I18nProvider';
import { useBasemap } from '@/hooks/useBasemap';
import { useCountryViewport } from '@/hooks/useCountryViewport';
import type { SwappingStation } from '@/types';

export interface SwappingStationMapProps {
  stations: SwappingStation[];
  height?: number;
}

type Translate = ReturnType<typeof useI18n>['t'];

const SWAP_SVG = trustedHtml(`<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`);

function pinHtml(size: number, grad: string, ring: string): TrustedHtml {
  const pad = 10;
  return html`<div style="position:relative;width:${size}px;height:${size}px"><div style="position:absolute;inset:-${pad}px;border-radius:50%;background:${ring};animation:markerPulse 2s ease-in-out infinite"></div><div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${grad});display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.22);border:2.5px solid white">${SWAP_SVG}</div></div>`;
}

/**
 * The cabinet popup. Every API value goes through the html`` tag, which escapes
 * it (see @/lib/html); the card paints its own light and dark panels, so it
 * reads the same in both themes.
 */
function stationPopup(s: SwappingStation, t: Translate): TrustedHtml {
  // No capacity, no share: "—" and an empty bar, not a red 0 % (FA-308).
  const avail = sharePercent(s.readyBatteries, s.totalCapacity);
  const barColor = avail === undefined ? '#94a3b8' : avail >= 60 ? '#10b981' : avail >= 35 ? '#f59e0b' : '#ef4444';
  return html`<div style="font-family:system-ui,sans-serif;width:250px;border-radius:12px;overflow:hidden">
  <div style="background:#1e293b;padding:12px 16px">
    <div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:2px">${s.name}</div>
    <div style="font-size:11px;color:#94a3b8">${t('batterySwapping.cabinetId')}: <span dir="ltr">${s.cabinetId}</span></div>
  </div>
  <div style="background:#fff;padding:14px 16px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">${t('batterySwapping.ready')}</div>
        <div style="font-size:22px;font-weight:800;color:#10b981;line-height:1">${s.readyBatteries}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">${t('batterySwapping.charging')}</div>
        <div style="font-size:22px;font-weight:800;color:#0284c7;line-height:1">${s.chargingBatteries}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">${t('batterySwapping.empty')}</div>
        <div style="font-size:22px;font-weight:800;color:#94a3b8;line-height:1">${s.emptySlots}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">${t('dashboard.total')}</div>
        <div style="font-size:22px;font-weight:800;color:#1e293b;line-height:1">${s.totalCapacity}</div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#64748b">${t('dashboard.availability')}</span>
        <span style="font-weight:700;color:${barColor}">${avail === undefined ? '—' : `${avail}%`}</span>
      </div>
      <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden">
        <div style="height:100%;background:${barColor};width:${avail ?? 0}%;border-radius:999px"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#64748b;margin-bottom:12px">
      <span>&#9201; ${t('mapPopup.avgWait', { minutes: s.avgWaitTimeMinutes })}</span>
      <span>${t('mapPopup.todaySwaps', { count: s.todaySwaps })}</span>
    </div>
    <button style="width:100%;background:#1e293b;color:#f8fafc;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.01em">${t('batterySwapping.viewDiagnostics')}</button>
  </div>
</div>`;
}

export default function SwappingStationMapInner({ stations, height = 420 }: SwappingStationMapProps) {
  const { t } = useI18n();
  const addBasemap   = useBasemap();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markersRef   = useRef<LeafletMarker[]>([]);
  const hasFittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const viewRef = useCountryViewport(mapRef, mapReady, hasFittedRef, 12);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      if (cancelled || !containerRef.current) return;

      // Placeholder viewport only — replaced by fitToPoints() over the real
      // markers as soon as any arrive. Never used to place a marker.
      const map: LeafletMap = L.map(containerRef.current, {
        center: viewRef.current.center,
        zoom: viewRef.current.zoom,
        zoomControl: true,
      });

      addBasemap(L, map);

      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      hasFittedRef.current = false;
      setMapReady(false);
    };
  }, [addBasemap, viewRef]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // A cabinet with no reported position is not drawn — the swapping-station
      // list labels it "location unknown" instead of pinning it to a guess.
      for (const s of stations) {
        if (!s.coordinates) continue;
        // Unknown availability is grey, not the red of an empty cabinet.
        const avail = sharePercent(s.readyBatteries, s.totalCapacity);
        const [grad, ring] =
          avail === undefined
            ? ['#94a3b8,#64748b', 'rgba(148,163,184,0.25)']
            : avail >= 60
            ? ['#10b981,#059669', 'rgba(16,185,129,0.25)']
            : avail >= 35
            ? ['#f59e0b,#d97706', 'rgba(245,158,11,0.25)']
            : ['#ef4444,#dc2626', 'rgba(239,68,68,0.25)'];

        const icon = L.divIcon({
          className: '',
          html: String(pinHtml(40, grad, ring)),
          iconSize:   [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -26],
        });

        const m: LeafletMarker = L.marker(
          [s.coordinates.lat, s.coordinates.lng],
          { icon }
        ).bindPopup(String(stationPopup(s, t)), {
          maxWidth: 270,
          minWidth: 270,
          className: 'map-popup',
          closeButton: true,
        });
        m.addTo(map);
        markersRef.current.push(m);
      }

      /* Frame what is actually on the map — once. See @/lib/map-fit. */
      if (!hasFittedRef.current) {
        const points = markersRef.current.map((m) => {
          const ll = m.getLatLng();
          return [ll.lat, ll.lng] as LatLngTuple;
        });
        hasFittedRef.current = fitToPoints(L, map, points, { maxZoom: 13 });
      }
    })();
    // `t` too: a language switch rebuilds the popups in the new language.
  }, [mapReady, stations, t]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgb(var(--border))', height }}
    >
      {/* Top-right in both directions: Leaflet keeps its zoom control top-left
          in Arabic too, so `end-4` would cover it there. */}
      <div className="pointer-events-none absolute right-4 top-4 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        {/* "Live Updates: Active" claimed polling that does not exist (FA-315). */}
        <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
        {t('mapPopup.lastKnownStatus')}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
