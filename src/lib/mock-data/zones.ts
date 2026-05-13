import type { Zone } from '@/types';

/**
 * Mock zones with polygon coords expressed as percentages of the map viewport.
 * Each polygon is a closed shape (the renderer handles closing the path).
 */
export const mockZones: Zone[] = [
  {
    id: 'ZN001',
    name: 'Downtown District',
    type: 'operational',
    speedLimitKmh: 45,
    active: true,
    visible: true,
    polygon: [
      { x: 24, y: 30 },
      { x: 36, y: 26 },
      { x: 44, y: 36 },
      { x: 38, y: 48 },
      { x: 24, y: 46 },
    ],
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'ZN002',
    name: 'Airport No-Ride Zone',
    type: 'no_ride',
    speedLimitKmh: 0,
    active: true,
    visible: true,
    polygon: [
      { x: 32, y: 60 },
      { x: 46, y: 58 },
      { x: 52, y: 70 },
      { x: 42, y: 78 },
      { x: 30, y: 72 },
    ],
    createdAt: '2026-02-08T14:30:00Z',
  },
  {
    id: 'ZN003',
    name: 'School Slow Zone',
    type: 'slow',
    speedLimitKmh: 15,
    active: true,
    visible: true,
    polygon: [
      { x: 60, y: 40 },
      { x: 72, y: 38 },
      { x: 78, y: 50 },
      { x: 70, y: 56 },
      { x: 60, y: 50 },
    ],
    createdAt: '2026-02-20T09:15:00Z',
  },
  {
    id: 'ZN004',
    name: 'Central Parking Area',
    type: 'parking',
    speedLimitKmh: 10,
    active: true,
    visible: true,
    polygon: [
      { x: 52, y: 78 },
      { x: 66, y: 76 },
      { x: 72, y: 88 },
      { x: 60, y: 92 },
      { x: 50, y: 86 },
    ],
    createdAt: '2026-03-05T16:45:00Z',
  },
];
