'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { fitToPoints, type LatLngTuple } from '@/lib/map-fit';
import { clampPercent, html, trustedHtml, type TrustedHtml } from '@/lib/html';
import { useI18n } from '@/i18n/I18nProvider';
import { useBasemap } from '@/hooks/useBasemap';
import type { Vehicle, BatteryStation } from '@/types';

export interface LiveFleetMapProps {
  vehicles?: Vehicle[];
  stations?: BatteryStation[];
  height?: number;
}

type Translate = ReturnType<typeof useI18n>['t'];

/* ── SVG icons (inline strings for divIcon) ─────────────── */
const BIKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;
const BAT_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1"/><path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="m11 7-4 5h6l-4 5"/><line x1="22" x2="22" y1="11" y2="13"/></svg>`;

const VEHICLE_COLORS: Record<string, { grad: string; ring: string }> = {
  active:      { grad: '#10b981,#059669', ring: 'rgba(16,185,129,0.28)' },
  charging:    { grad: '#38bdf8,#0284c7', ring: 'rgba(56,189,248,0.28)' },
  idle:        { grad: '#94a3b8,#64748b', ring: 'rgba(148,163,184,0.28)' },
  maintenance: { grad: '#fb923c,#ea580c', ring: 'rgba(251,146,60,0.28)' },
};

function pinHtml(size: number, grad: string, ring: string, svg: string): TrustedHtml {
  const pad = 10;
  return html`<div style="position:relative;width:${size}px;height:${size}px"><div style="position:absolute;inset:-${pad}px;border-radius:50%;background:${ring};animation:markerPulse 2s ease-in-out infinite"></div><div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${grad});display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.22);border:2.5px solid white">${trustedHtml(svg)}</div></div>`;
}

/* ── Popup HTML generators ───────────────────────────────── */
//
// Every API value goes through the html`` tag, which escapes it (see
// @/lib/html). Text sitting on the popup card uses the theme tokens: the card
// is rgb(var(--card)), which is dark in dark mode.

function stationPopup(s: BatteryStation, t: Translate): TrustedHtml {
  const avail = Math.round(clampPercent((s.available / s.totalCapacity) * 100));
  const barColor = avail >= 60 ? '#10b981' : avail >= 30 ? '#f59e0b' : '#ef4444';
  const batIconBlue = BAT_SVG.replace(/stroke="white"/g, 'stroke="#0284c7"').replace('width="15" height="15"', 'width="16" height="16"');
  return html`<div style="font-family:system-ui,sans-serif;width:256px;padding:16px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <div style="width:32px;height:32px;background:#e0f2fe;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${trustedHtml(batIconBlue)}</div>
    <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:rgb(var(--foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:185px">${s.name}</div><div style="font-size:11px;color:rgb(var(--muted-foreground))">${s.district} · ${t('dashboard.batteryStation')}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
    <div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700;color:#16a34a">${s.available}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b">${t('dashboard.available')}</div></div>
    <div style="background:#fff7ed;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700;color:#ea580c">${s.inUse}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b">${t('dashboard.inUse')}</div></div>
    <div style="background:#f1f5f9;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:700;color:#475569">${s.totalCapacity}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b">${t('dashboard.total')}</div></div>
  </div>
  <div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:rgb(var(--muted-foreground))">${t('dashboard.availability')}</span><span style="font-weight:600;color:rgb(var(--foreground))">${avail}%</span></div>
    <div style="height:6px;background:rgb(var(--muted));border-radius:999px;overflow:hidden"><div style="height:100%;background:${barColor};width:${avail}%;border-radius:999px"></div></div>
  </div>
  <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:rgb(var(--muted-foreground))"><span>&#9201; ${t('mapPopup.minWait', { minutes: s.avgWaitTimeMinutes })}</span><span>${t('mapPopup.swapsToday', { count: s.todaySwaps })}</span></div>
</div>`;
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active:      { bg: '#dcfce7', color: '#15803d' },
  charging:    { bg: '#e0f2fe', color: '#0369a1' },
  idle:        { bg: '#f1f5f9', color: '#475569' },
  maintenance: { bg: '#ffedd5', color: '#c2410c' },
};

function vehiclePopup(v: Vehicle, t: Translate): TrustedHtml {
  // An unknown status is drawn as idle, label and colours alike.
  const status = Object.prototype.hasOwnProperty.call(STATUS_BADGE, v.status) ? v.status : 'idle';
  const sc = STATUS_BADGE[status];
  const battery = clampPercent(v.batteryLevel);
  const batColor = battery >= 60 ? '#10b981' : battery >= 30 ? '#f59e0b' : '#ef4444';
  const bikeIconIndigo = BIKE_SVG.replace(/stroke="white"/g, 'stroke="#4f46e5"');
  const driverLine = v.assignedDriverName
    ? html`<div style="font-size:11px;color:rgb(var(--muted-foreground));margin-bottom:10px">&#128100; ${v.assignedDriverName}</div>` : '';
  const speedLine = v.currentSpeedKmh > 0
    ? html`<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px"><span style="color:rgb(var(--muted-foreground))">${t('mapPopup.speed')}</span><span style="font-weight:600;color:rgb(var(--foreground))">${v.currentSpeedKmh} ${t('common.kmh')}</span></div>` : '';
  return html`<div style="font-family:system-ui,sans-serif;width:224px;padding:16px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;min-width:0">
      <div style="width:32px;height:32px;background:#eef2ff;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${trustedHtml(bikeIconIndigo)}</div>
      <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:rgb(var(--foreground))"><span dir="ltr">${v.plateNumber}</span></div><div style="font-size:11px;color:rgb(var(--muted-foreground))">${v.model}</div></div>
    </div>
    <span style="font-size:10px;padding:2px 8px;border-radius:999px;font-weight:600;background:${sc.bg};color:${sc.color};flex-shrink:0;white-space:nowrap">${t(`status.${status}`)}</span>
  </div>
  ${driverLine}
  <div style="margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:rgb(var(--muted-foreground))">${t('fleet.battery')}</span><span style="font-weight:600;color:rgb(var(--foreground))">${battery}%</span></div>
    <div style="height:6px;background:rgb(var(--muted));border-radius:999px;overflow:hidden"><div style="height:100%;background:${batColor};width:${battery}%;border-radius:999px"></div></div>
  </div>
  ${speedLine}
  <div style="font-size:11px;color:rgb(var(--muted-foreground))">&#128205; ${v.location}</div>
</div>`;
}

/* ── Component ───────────────────────────────────────────── */

export default function LiveFleetMapInner({
  vehicles = [],
  stations = [],
  height = 380,
}: LiveFleetMapProps) {
  const { t } = useI18n();
  const addBasemap   = useBasemap();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markersRef   = useRef<LeafletMarker[]>([]);
  const hasFittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  /* Initialize map once */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      if (cancelled || !containerRef.current) return;

      // Placeholder viewport only — replaced by fitBounds() over the real
      // markers as soon as any arrive. Never used to place a marker.
      const map: LeafletMap = L.map(containerRef.current, {
        center: [24.74, 46.672],
        zoom: 13,
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
  }, [addBasemap]);

  /* Re-draw markers whenever map is ready or data changes */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      /* Clear old markers */
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      /* Station markers — same rule as vehicles: no position, no pin. */
      for (const s of stations) {
        if (!s.coordinates) continue;
        const icon = L.divIcon({
          className: '',
          html: String(pinHtml(40, '#38bdf8,#0284c7', 'rgba(56,189,248,0.25)', BAT_SVG)),
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -26],
        });
        const m: LeafletMarker = L.marker(
          [s.coordinates.lat, s.coordinates.lng],
          { icon }
        ).bindPopup(String(stationPopup(s, t)), {
          maxWidth: 280,
          minWidth: 280,
          className: 'map-popup',
          closeButton: false,
        });
        m.addTo(map);
        markersRef.current.push(m);
      }

      /* Vehicle markers — only for vehicles that have actually reported a
         position. There is no fallback coordinate: an offline bike used to be
         drawn on a hardcoded central-Riyadh point, which put a Jordanian fleet's
         offline half in another country. Unlocated vehicles are surfaced in the
         fleet list instead (see LocationLabel). */
      for (const v of vehicles) {
        if (!v.coordinates) continue;
        const c = VEHICLE_COLORS[v.status] ?? VEHICLE_COLORS.active;
        const icon = L.divIcon({
          className: '',
          html: String(pinHtml(34, c.grad, c.ring, BIKE_SVG)),
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -22],
        });
        const m: LeafletMarker = L.marker(
          [v.coordinates.lat, v.coordinates.lng],
          { icon }
        ).bindPopup(String(vehiclePopup(v, t)), {
          maxWidth: 260,
          minWidth: 240,
          className: 'map-popup',
          closeButton: false,
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
        hasFittedRef.current = fitToPoints(L, map, points);
      }
    })();
    // `t` too: a language switch rebuilds the popups in the new language.
  }, [mapReady, vehicles, stations, t]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgb(var(--border))', height }}
    >
      {/* Live badge — sits above the map via z-index */}
      <div className="pointer-events-none absolute start-4 top-4 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t('common.liveUpdates')}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
