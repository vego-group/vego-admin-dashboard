'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { Bike, Maximize2, Minus, Plus, Sparkles, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { ZONE_TYPES, ZONE_TYPE_LIST } from '@/lib/zone-types';
import { cn } from '@/lib/cn';
import type { Vehicle, Zone, ZonePoint } from '@/types';

interface ZoneMapProps {
  zones: Zone[];
  vehicles?: Vehicle[];
  selectedZoneId?: string | null;
  onZoneClick?: (zone: Zone) => void;

  // Drawing mode props
  drawingMode?: boolean;
  drawingPoints?: ZonePoint[];
  onDrawingPointAdd?: (point: ZonePoint) => void;
}

// Static positions for vehicle pins (matching the figma)
const VEHICLE_PINS = [
  { x: 26, y: 30, status: 'active' as const },
  { x: 36, y: 38, status: 'active' as const },
  { x: 38, y: 42, status: 'active' as const },
  { x: 38, y: 64, status: 'active' as const },
  { x: 46, y: 64, status: 'active' as const },
  { x: 42, y: 70, status: 'active' as const },
  { x: 64, y: 44, status: 'charging' as const },
  { x: 70, y: 50, status: 'charging' as const },
  { x: 76, y: 56, status: 'idle' as const },
  { x: 60, y: 80, status: 'active' as const },
];

export function ZoneMap({
  zones,
  selectedZoneId,
  onZoneClick,
  drawingMode = false,
  drawingPoints = [],
  onDrawingPointAdd,
}: ZoneMapProps) {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  const handleMapClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!drawingMode || !onDrawingPointAdd || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onDrawingPointAdd({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  return (
    <div
      ref={mapRef}
      onClick={handleMapClick}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-2xl border bg-slate-50 dark:bg-slate-900/40',
        drawingMode && 'cursor-crosshair'
      )}
      style={{ borderColor: 'rgb(var(--border))', minHeight: 500 }}
    >
      {/* Stylized base map */}
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="zmBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="zmPark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#zmBg)" />
        {/* Park */}
        <path
          d="M 80,80 Q 200,40 340,90 T 480,160 L 460,260 Q 340,290 200,250 Q 100,230 80,80 Z"
          fill="url(#zmPark)"
          opacity="0.55"
        />
        <path
          d="M 540,360 Q 660,340 740,400 L 760,500 Q 660,540 580,490 Z"
          fill="url(#zmPark)"
          opacity="0.55"
        />
        {/* Major roads */}
        <g stroke="#fbbf24" strokeWidth="3" fill="none" opacity="0.6">
          <path d="M 0,260 Q 200,240 400,260 T 800,270" />
          <path d="M 100,0 Q 120,200 140,400 T 180,600" />
          <path d="M 0,440 L 800,420" />
          <path d="M 500,0 L 480,600" />
        </g>
        {/* Minor roads */}
        <g stroke="#cbd5e1" strokeWidth="1.5" fill="none" opacity="0.7">
          <path d="M 0,140 L 800,150" />
          <path d="M 0,200 L 800,220" />
          <path d="M 0,360 L 800,360" />
          <path d="M 250,0 L 260,600" />
          <path d="M 350,0 L 360,600" />
          <path d="M 600,0 L 610,600" />
          <path d="M 700,0 L 710,600" />
        </g>
        {/* Building blocks */}
        <g fill="#ffffff" opacity="0.5">
          <rect x="160" y="160" width="35" height="35" rx="3" />
          <rect x="220" y="170" width="40" height="30" rx="3" />
          <rect x="370" y="160" width="40" height="40" rx="3" />
          <rect x="630" y="170" width="45" height="35" rx="3" />
          <rect x="280" y="380" width="40" height="35" rx="3" />
          <rect x="630" y="370" width="35" height="30" rx="3" />
          <rect x="370" y="380" width="50" height="35" rx="3" />
        </g>
      </svg>

      {/* Zone polygons (rendered in SVG for crisp edges) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {zones
          .filter((z) => z.visible && z.polygon.length >= 3)
          .map((zone) => {
            const config = ZONE_TYPES[zone.type];
            const path = polygonToPath(zone.polygon);
            const isSelected = zone.id === selectedZoneId;
            return (
              <g key={zone.id} className="pointer-events-auto">
                <path
                  d={path}
                  fill={config.color}
                  fillOpacity={isSelected ? 0.32 : 0.22}
                  stroke={config.color}
                  strokeWidth={isSelected ? 0.6 : 0.4}
                  strokeOpacity={0.9}
                  vectorEffect="non-scaling-stroke"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoneClick?.(zone);
                  }}
                  onMouseEnter={() => setHoveredZone(zone)}
                  onMouseLeave={() => setHoveredZone(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

        {/* Drawing-in-progress polygon */}
        {drawingMode && drawingPoints.length > 0 && (
          <g>
            {drawingPoints.length >= 2 && (
              <path
                d={polygonToPath(drawingPoints, drawingPoints.length < 3)}
                fill="#6366f1"
                fillOpacity="0.18"
                stroke="#6366f1"
                strokeWidth="0.5"
                strokeDasharray="1.5 1"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {drawingPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="0.8"
                fill="#6366f1"
                stroke="#fff"
                strokeWidth="0.3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}
      </svg>

      {/* Zone name labels */}
      {zones
        .filter((z) => z.visible && z.polygon.length >= 3)
        .map((zone) => {
          const center = polygonCenter(zone.polygon);
          const config = ZONE_TYPES[zone.type];
          return (
            <div
              key={`label-${zone.id}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${center.x}%`, top: `${center.y}%` }}
            >
              <span
                className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: config.color }}
              >
                {zone.name}
              </span>
            </div>
          );
        })}

      {/* Vehicle pins */}
      {!drawingMode &&
        VEHICLE_PINS.map((p, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white',
                p.status === 'active'
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                  : p.status === 'charging'
                  ? 'bg-gradient-to-br from-sky-400 to-blue-500'
                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
              )}
            >
              <Bike className="h-3.5 w-3.5" />
            </span>
          </span>
        ))}

      {/* Hovered zone popover */}
      {hoveredZone && !drawingMode && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full -mt-3"
          style={{
            left: `${polygonCenter(hoveredZone.polygon).x}%`,
            top: `${polygonCenter(hoveredZone.polygon).y}%`,
          }}
        >
          <ZoneHoverCard zone={hoveredZone} />
        </div>
      )}

      {/* Live updates badge */}
      <div className="pointer-events-none absolute start-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t('common.liveUpdates')}
      </div>

      {/* Drawing mode hint */}
      {drawingMode && (
        <div className="pointer-events-none absolute start-1/2 top-12 z-10 -translate-x-1/2">
          <DrawingHint pointsCount={drawingPoints.length} />
        </div>
      )}

      {/* Zone types legend */}
      <div className="absolute bottom-4 start-4 z-10 rounded-xl border bg-white/95 p-3 text-xs shadow-sm backdrop-blur dark:bg-slate-900/90"
        style={{ borderColor: 'rgb(var(--border))' }}>
        <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
          {t('zones.zoneTypesLegend')}
        </p>
        <ul className="space-y-1.5">
          {ZONE_TYPE_LIST.map((cfg) => (
            <li key={cfg.type} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {t(`zones.types.${cfg.labelKey}Long`)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Zoom controls */}
      <div className="absolute end-4 bottom-4 z-10 flex flex-col gap-1.5">
        <MapButton aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </MapButton>
        <MapButton aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </MapButton>
        <MapButton aria-label="Fullscreen">
          <Maximize2 className="h-4 w-4" />
        </MapButton>
      </div>
    </div>
  );
}

// ----- Helpers ----------------------------------------------------------------

function polygonToPath(points: ZonePoint[], openPath = false): string {
  if (points.length === 0) return '';
  const head = `M ${points[0].x} ${points[0].y}`;
  const rest = points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
  return openPath ? `${head} ${rest}` : `${head} ${rest} Z`;
}

function polygonCenter(points: ZonePoint[]): ZonePoint {
  if (points.length === 0) return { x: 50, y: 50 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function MapButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
      {...props}
    >
      {children}
    </button>
  );
}

function ZoneHoverCard({ zone }: { zone: Zone }) {
  const { t } = useI18n();
  const config = ZONE_TYPES[zone.type];
  return (
    <div className="rounded-xl border bg-white p-3 shadow-elevated dark:bg-slate-900"
      style={{ borderColor: 'rgb(var(--border))', minWidth: 180 }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-bold text-slate-900 dark:text-slate-50">{zone.name}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-500">{t(`zones.types.${config.labelKey}`)}</span>
        <span
          className="font-bold"
          style={{ color: config.color }}
        >
          {config.speedLabelOverride === 'no_riding'
            ? t('zones.noRide').toUpperCase()
            : `${zone.speedLimitKmh} km/h`}
        </span>
      </div>
    </div>
  );
}

function DrawingHint({ pointsCount }: { pointsCount: number }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border-2 border-brand-400 bg-white px-5 py-3 shadow-elevated dark:bg-slate-900"
      style={{ minWidth: 280 }}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
            {t('zones.drawingModeActive')}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {pointsCount === 0
              ? t('zones.drawingModeHint')
              : pointsCount < 3
              ? t('zones.drawingNeedMorePoints')
              : t('zones.drawingPointsCount', { count: pointsCount })}
          </p>
        </div>
      </div>
    </div>
  );
}
