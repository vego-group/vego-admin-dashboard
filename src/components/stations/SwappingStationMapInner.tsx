'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import type { SwappingStation } from '@/types';

export interface SwappingStationMapProps {
  stations: SwappingStation[];
  height?: number;
}

const SWAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;

function pinHtml(size: number, grad: string, ring: string) {
  const pad = 10;
  return `<div style="position:relative;width:${size}px;height:${size}px"><div style="position:absolute;inset:-${pad}px;border-radius:50%;background:${ring};animation:markerPulse 2s ease-in-out infinite"></div><div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${grad});display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.22);border:2.5px solid white">${SWAP_SVG}</div></div>`;
}

function stationPopup(s: SwappingStation): string {
  const avail = s.totalCapacity > 0 ? Math.round((s.readyBatteries / s.totalCapacity) * 100) : 0;
  const barColor = avail >= 60 ? '#10b981' : avail >= 35 ? '#f59e0b' : '#ef4444';
  return `<div style="font-family:system-ui,sans-serif;width:250px;border-radius:12px;overflow:hidden">
  <div style="background:#1e293b;padding:12px 16px">
    <div style="font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:2px">${s.name}</div>
    <div style="font-size:11px;color:#94a3b8">Cabinet ID: ${s.cabinetId}</div>
  </div>
  <div style="background:#fff;padding:14px 16px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">Ready</div>
        <div style="font-size:22px;font-weight:800;color:#10b981;line-height:1">${s.readyBatteries}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">Charging</div>
        <div style="font-size:22px;font-weight:800;color:#0284c7;line-height:1">${s.chargingBatteries}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">Empty</div>
        <div style="font-size:22px;font-weight:800;color:#94a3b8;line-height:1">${s.emptySlots}</div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:2px">Total</div>
        <div style="font-size:22px;font-weight:800;color:#1e293b;line-height:1">${s.totalCapacity}</div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#64748b">Availability</span>
        <span style="font-weight:700;color:${barColor}">${avail}%</span>
      </div>
      <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden">
        <div style="height:100%;background:${barColor};width:${avail}%;border-radius:999px"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:12px">
      <span>&#9201; Avg Wait: ${s.avgWaitTimeMinutes} min</span>
      <span>Today: ${s.todaySwaps} swaps</span>
    </div>
    <button style="width:100%;background:#1e293b;color:#f8fafc;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.01em">View Full Diagnostics</button>
  </div>
</div>`;
}

export default function SwappingStationMapInner({ stations, height = 420 }: SwappingStationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markersRef   = useRef<LeafletMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      if (cancelled || !containerRef.current) return;

      const map: LeafletMap = L.map(containerRef.current, {
        center: [24.74, 46.672],
        zoom: 12,
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

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (await import('leaflet')) as any;
      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      for (const s of stations) {
        const avail = s.totalCapacity > 0 ? (s.readyBatteries / s.totalCapacity) * 100 : 0;
        const [grad, ring] =
          avail >= 60
            ? ['#10b981,#059669', 'rgba(16,185,129,0.25)']
            : avail >= 35
            ? ['#f59e0b,#d97706', 'rgba(245,158,11,0.25)']
            : ['#ef4444,#dc2626', 'rgba(239,68,68,0.25)'];

        const icon = L.divIcon({
          className: '',
          html: pinHtml(40, grad, ring),
          iconSize:   [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -26],
        });

        const m: LeafletMarker = L.marker(
          [s.coordinates.lat, s.coordinates.lng],
          { icon }
        ).bindPopup(stationPopup(s), {
          maxWidth: 270,
          minWidth: 270,
          className: 'map-popup',
          closeButton: true,
        });
        m.addTo(map);
        markersRef.current.push(m);
      }
    })();
  }, [mapReady, stations]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgb(var(--border))', height }}
    >
      <div className="pointer-events-none absolute start-4 top-4 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live Updates: Active
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
