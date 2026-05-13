'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ZONE_TYPES, ZONE_TYPE_LIST } from '@/lib/zone-types';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Vehicle, Zone, ZonePoint } from '@/types';

export interface ZoneMapProps {
  zones: Zone[];
  vehicles?: Vehicle[];
  selectedZoneId?: string | null;
  onZoneClick?: (zone: Zone) => void;
  drawingMode?: boolean;
  drawingPoints?: ZonePoint[];
  onDrawingPointAdd?: (point: ZonePoint) => void;
}

/* ── Coordinate helpers ──────────────────────────────────── */

// Riyadh bounding box — maps ZonePoint (0-100%) to real lat/lng
const B = { north: 24.83, south: 24.62, west: 46.58, east: 46.80 };

function toLL(p: ZonePoint): [number, number] {
  return [
    B.north - (p.y / 100) * (B.north - B.south),
    B.west  + (p.x / 100) * (B.east  - B.west),
  ];
}

function toLLArr(pts: ZonePoint[]): [number, number][] {
  return pts.map(toLL);
}

function fromLL(lat: number, lng: number): ZonePoint {
  return {
    x: Math.max(0, Math.min(100, ((lng - B.west)  / (B.east  - B.west))  * 100)),
    y: Math.max(0, Math.min(100, ((B.north - lat) / (B.north - B.south)) * 100)),
  };
}

function pctCenter(pts: ZonePoint[]): ZonePoint {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

/* ── Tooltip HTML ────────────────────────────────────────── */

const TYPE_LABEL: Record<string, string> = {
  operational: 'Operational Zone',
  noRide:      'No-Ride Zone',
  slow:        'Slow Zone',
  parking:     'Parking Area',
};

function zoneTooltipHtml(zone: Zone): string {
  const cfg = ZONE_TYPES[zone.type];
  const label = TYPE_LABEL[cfg.labelKey] ?? cfg.labelKey;
  const speed = cfg.speedLabelOverride === 'no_riding' ? 'NO RIDING' : `${zone.speedLimitKmh} km/h`;
  return `<div style="font-family:system-ui,sans-serif;padding:10px 14px;min-width:170px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      <span style="width:8px;height:8px;border-radius:50%;background:${cfg.color};flex-shrink:0"></span>
      <span style="font-size:12px;font-weight:700;color:#0f172a">${zone.name}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;gap:12px">
      <span style="color:#64748b">${label}</span>
      <span style="font-weight:700;padding:1px 7px;border-radius:999px;background:${cfg.color}22;color:${cfg.color}">${speed}</span>
    </div>
  </div>`;
}

/* ── Vehicle icon HTML ───────────────────────────────────── */

const BIKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

const V_COLORS: Record<string, string> = {
  active:      'linear-gradient(135deg,#10b981,#059669)',
  charging:    'linear-gradient(135deg,#38bdf8,#0284c7)',
  idle:        'linear-gradient(135deg,#94a3b8,#64748b)',
  maintenance: 'linear-gradient(135deg,#fb923c,#ea580c)',
};

/* ── Component ───────────────────────────────────────────── */

export default function ZoneMapInner({
  zones,
  vehicles = [],
  selectedZoneId,
  onZoneClick,
  drawingMode = false,
  drawingPoints = [],
  onDrawingPointAdd,
}: ZoneMapProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef        = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Layer refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoneLayers    = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vehiclePins   = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewPoly   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previewDots   = useRef<any[]>([]);

  // Stable callback refs (avoid stale closures in Leaflet handlers)
  const onZoneClickRef          = useRef(onZoneClick);
  const onDrawingPointAddRef    = useRef(onDrawingPointAdd);
  const drawingModeRef          = useRef(drawingMode);

  useEffect(() => { onZoneClickRef.current = onZoneClick; },       [onZoneClick]);
  useEffect(() => { onDrawingPointAddRef.current = onDrawingPointAdd; }, [onDrawingPointAdd]);
  useEffect(() => { drawingModeRef.current = drawingMode; },        [drawingMode]);

  /* 1 ── Initialize Leaflet map (once) */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [24.74, 46.69],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ).addTo(map);

      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  /* 2 ── Draw zone polygons + labels */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      // Clear previous
      zoneLayers.current.forEach((l) => l.remove());
      zoneLayers.current = [];

      for (const zone of zones.filter((z) => z.visible && z.polygon.length >= 3)) {
        const cfg = ZONE_TYPES[zone.type];
        const isSelected = zone.id === selectedZoneId;

        // Polygon
        const poly = L.polygon(toLLArr(zone.polygon), {
          color:        cfg.color,
          fillColor:    cfg.color,
          fillOpacity:  isSelected ? 0.38 : 0.22,
          weight:       isSelected ? 2.5  : 1.5,
          opacity:      0.9,
        });

        poly.bindTooltip(zoneTooltipHtml(zone), {
          sticky:    true,
          className: 'zone-tooltip',
          direction: 'top',
          offset:    [0, -8],
        });

        poly.on('click', () => {
          if (!drawingModeRef.current) onZoneClickRef.current?.(zone);
        });

        poly.addTo(map);
        zoneLayers.current.push(poly);

        // Name label at polygon center
        const center = pctCenter(zone.polygon);
        const labelIcon = L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-50%);white-space:nowrap"><span style="display:inline-block;background:${cfg.color};color:white;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.25)">${zone.name}</span></div>`,
          iconSize:   [0, 0],
          iconAnchor: [0, 0],
        });
        const label = L.marker(toLL(center), { icon: labelIcon, interactive: false, zIndexOffset: 200 });
        label.addTo(map);
        zoneLayers.current.push(label);
      }
    })();
  }, [mapReady, zones, selectedZoneId]);

  /* 3 ── Vehicle pins */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      vehiclePins.current.forEach((m) => m.remove());
      vehiclePins.current = [];

      for (const v of vehicles) {
        if (!v.coordinates) continue;
        const grad = V_COLORS[v.status] ?? V_COLORS.active;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);border:2px solid white">${BIKE_SVG}</div>`,
          iconSize:   [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker([v.coordinates.lat, v.coordinates.lng], { icon, interactive: false });
        m.addTo(map);
        vehiclePins.current.push(m);
      }
    })();
  }, [mapReady, vehicles]);

  /* 4 ── Drawing mode: click handler + cursor */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    (async () => {
      await import('leaflet');
      if (!mapRef.current) return;

      map.off('click');
      map.getContainer().style.cursor = drawingMode ? 'crosshair' : '';

      if (drawingMode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on('click', (e: any) => {
          const pt = fromLL(e.latlng.lat, e.latlng.lng);
          onDrawingPointAddRef.current?.(pt);
        });
      }
    })();

    return () => {
      mapRef.current?.off('click');
    };
  }, [mapReady, drawingMode]);

  /* 5 ── Drawing preview polygon + point dots */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      // Clear previous preview
      previewPoly.current?.remove();
      previewPoly.current = null;
      previewDots.current.forEach((d) => d.remove());
      previewDots.current = [];

      if (!drawingMode || drawingPoints.length === 0) return;

      // Preview polygon (dashed)
      if (drawingPoints.length >= 2) {
        previewPoly.current = L.polygon(toLLArr(drawingPoints), {
          color:       '#6366f1',
          fillColor:   '#6366f1',
          fillOpacity: 0.15,
          weight:      2,
          dashArray:   '6 4',
        }).addTo(map);
      }

      // Dot at each placed point
      for (const p of drawingPoints) {
        const dot = L.circleMarker(toLL(p), {
          radius:      5,
          color:       '#6366f1',
          fillColor:   '#6366f1',
          fillOpacity: 1,
          weight:      2,
        }).addTo(map);
        previewDots.current.push(dot);
      }
    })();
  }, [mapReady, drawingMode, drawingPoints]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-2xl border',
        drawingMode && 'ring-2 ring-brand-400'
      )}
      style={{ borderColor: 'rgb(var(--border))', minHeight: 500 }}
    >
      {/* Live badge */}
      <div className="pointer-events-none absolute start-4 top-4 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t('common.liveUpdates')}
      </div>

      {/* Drawing hint */}
      {drawingMode && (
        <div className="pointer-events-none absolute start-1/2 top-14 z-[1001] -translate-x-1/2">
          <div className="rounded-2xl border-2 border-brand-400 bg-white px-5 py-3 shadow-elevated dark:bg-slate-900" style={{ minWidth: 280 }}>
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  {t('zones.drawingModeActive')}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {drawingPoints.length === 0
                    ? t('zones.drawingModeHint')
                    : drawingPoints.length < 3
                    ? t('zones.drawingNeedMorePoints')
                    : t('zones.drawingPointsCount').replace('{{count}}', String(drawingPoints.length))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone types legend */}
      <div
        className="absolute bottom-4 start-4 z-[1001] rounded-xl border bg-white/95 p-3 text-xs shadow-sm backdrop-blur dark:bg-slate-900/90"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
          {t('zones.zoneTypesLegend')}
        </p>
        <ul className="space-y-1.5">
          {ZONE_TYPE_LIST.map((cfg) => (
            <li key={cfg.type} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-slate-600 dark:text-slate-300">
                {t(`zones.types.${cfg.labelKey}Long`)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Map canvas */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
