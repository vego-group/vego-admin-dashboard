'use client';

import { useState } from 'react';
import { Bike, BatteryCharging, Maximize2, Minus, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { BatteryStation, Vehicle } from '@/types';

interface MapMarker {
  id: string;
  type: 'vehicle' | 'station';
  x: number; // percent 0-100
  y: number; // percent 0-100
  status?: 'active' | 'charging' | 'idle' | 'maintenance';
  label?: string;
  data?: Vehicle | BatteryStation;
}

interface LiveFleetMapProps {
  markers?: MapMarker[];
  height?: number;
  showFleetMarkers?: boolean;
  selectedStation?: BatteryStation | null;
}

const defaultMarkers: MapMarker[] = [
  { id: 'v1', type: 'vehicle', x: 32, y: 56, status: 'active' },
  { id: 'v2', type: 'vehicle', x: 48, y: 38, status: 'active' },
  { id: 's1', type: 'station', x: 50, y: 42 },
  { id: 'v3', type: 'vehicle', x: 65, y: 62, status: 'charging' },
];

export function LiveFleetMap({
  markers = defaultMarkers,
  height = 380,
  selectedStation,
}: LiveFleetMapProps) {
  const { t } = useI18n();
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(
    selectedStation
      ? {
          id: selectedStation.id,
          type: 'station',
          x: 50,
          y: 42,
          data: selectedStation,
        }
      : null
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-slate-50 dark:bg-slate-900/40"
      style={{ borderColor: 'rgb(var(--border))', height }}
    >
      {/* Stylized map background */}
      <svg
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Background */}
        <rect width="800" height="400" fill="url(#mapBg)" />

        <defs>
          <linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="park" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>

        {/* Park areas */}
        <path
          d="M 50,80 Q 120,40 200,90 T 340,140 L 320,200 Q 220,220 140,180 Q 60,160 50,80 Z"
          fill="url(#park)"
          opacity="0.6"
        />
        <path
          d="M 580,260 Q 680,240 740,290 L 760,360 Q 660,380 580,340 Z"
          fill="url(#park)"
          opacity="0.6"
        />

        {/* Water body */}
        <path
          d="M 460,180 Q 520,160 560,200 Q 540,240 480,230 Q 440,210 460,180 Z"
          fill="url(#water)"
          opacity="0.7"
        />

        {/* Major roads */}
        <g stroke="#fbbf24" strokeWidth="3" fill="none" opacity="0.6">
          <path d="M 0,200 Q 200,180 400,200 T 800,210" />
          <path d="M 100,0 Q 120,150 140,300 T 180,400" />
          <path d="M 0,320 L 800,300" />
          <path d="M 500,0 L 480,400" />
        </g>

        {/* Minor roads */}
        <g stroke="#cbd5e1" strokeWidth="1.5" fill="none" opacity="0.7">
          <path d="M 0,100 L 800,110" />
          <path d="M 0,150 L 800,160" />
          <path d="M 0,260 L 800,260" />
          <path d="M 250,0 L 260,400" />
          <path d="M 350,0 L 360,400" />
          <path d="M 600,0 L 610,400" />
          <path d="M 700,0 L 710,400" />
        </g>

        {/* Building blocks */}
        <g fill="#ffffff" opacity="0.5">
          <rect x="110" y="115" width="30" height="30" rx="3" />
          <rect x="160" y="120" width="40" height="25" rx="3" />
          <rect x="270" y="115" width="35" height="30" rx="3" />
          <rect x="370" y="115" width="40" height="40" rx="3" />
          <rect x="280" y="270" width="40" height="35" rx="3" />
          <rect x="630" y="115" width="45" height="35" rx="3" />
          <rect x="630" y="265" width="35" height="30" rx="3" />
          <rect x="370" y="270" width="50" height="35" rx="3" />
        </g>
      </svg>

      {/* Live update badge */}
      <div className="pointer-events-none absolute start-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t('common.liveUpdates')}
      </div>

      {/* Map controls */}
      <div className="absolute end-4 top-4 z-10 flex flex-col gap-1.5">
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

      {/* Markers */}
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setActiveMarker(m)}
          className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          <MarkerPin marker={m} />
        </button>
      ))}

      {/* Selected marker popover (battery station) */}
      {activeMarker && activeMarker.type === 'station' && activeMarker.data && (
        <StationPopover
          station={activeMarker.data as BatteryStation}
          onClose={() => setActiveMarker(null)}
        />
      )}

      {/* Map attribution */}
      <div className="pointer-events-none absolute end-3 bottom-2 z-10 text-[10px] text-slate-500/80">
        MyVego · Map
      </div>
    </div>
  );
}

function MapButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
      {...props}
    >
      {children}
    </button>
  );
}

function MarkerPin({ marker }: { marker: MapMarker }) {
  if (marker.type === 'station') {
    return (
      <span className="relative flex items-center justify-center">
        <span className="absolute h-12 w-12 rounded-full bg-sky-400/30 animate-pulse-ring" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg ring-4 ring-white">
          <BatteryCharging className="h-4 w-4" />
        </span>
      </span>
    );
  }
  const colorMap = {
    active: 'from-emerald-400 to-emerald-600',
    charging: 'from-sky-400 to-blue-500',
    idle: 'from-slate-400 to-slate-500',
    maintenance: 'from-orange-400 to-orange-600',
  };
  const color = colorMap[marker.status ?? 'active'];
  return (
    <span className="relative flex items-center justify-center">
      <span className={cn('absolute h-10 w-10 rounded-full opacity-30 animate-pulse-ring',
        marker.status === 'charging' ? 'bg-sky-400' : 'bg-emerald-400'
      )} />
      <span
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ring-4 ring-white',
          color
        )}
      >
        <Bike className="h-3.5 w-3.5" />
      </span>
    </span>
  );
}

function StationPopover({
  station,
  onClose,
}: {
  station: BatteryStation;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const availability = Math.round((station.available / station.totalCapacity) * 100);
  return (
    <div className="absolute start-1/2 top-[42%] z-30 w-64 -translate-x-1/2 -translate-y-full">
      <Card className="overflow-hidden p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <BatteryCharging className="h-3.5 w-3.5" />
              </span>
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {station.name}
              </h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('dashboard.batteryStation')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-500/10">
            <div className="text-base font-bold text-emerald-600">{station.available}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {t('dashboard.available')}
            </div>
          </div>
          <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-500/10">
            <div className="text-base font-bold text-orange-600">{station.inUse}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {t('dashboard.inUse')}
            </div>
          </div>
          <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
            <div className="text-base font-bold text-slate-700 dark:text-slate-200">
              {station.totalCapacity}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {t('dashboard.total')}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{t('dashboard.availability')}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{availability}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              style={{ width: `${availability}%` }}
            />
          </div>
        </div>
      </Card>
      {/* Pointer */}
      <div className="absolute start-1/2 top-full -mt-px h-3 w-3 -translate-x-1/2 rotate-45 border-b border-e bg-[rgb(var(--card))]"
        style={{ borderColor: 'rgb(var(--border))' }} />
    </div>
  );
}
