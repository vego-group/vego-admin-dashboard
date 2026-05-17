import type { Notification } from '@/types';

const base = new Date('2026-05-14T12:00:00Z').getTime();
const minsAgo = (m: number) => new Date(base - m * 60_000).toISOString();

export const mockNotifications: Notification[] = [
  {
    id: 'N001',
    type: 'alert',
    title: 'Low Battery Alert',
    description: 'Vehicle VEGO-001 battery is below 15%. Immediate charging recommended.',
    createdAt: minsAgo(2),
    read: false,
  },
  {
    id: 'N002',
    type: 'warning',
    title: 'Maintenance Required',
    description: 'Vehicle VEGO-015 has reached 5000 km. Schedule maintenance check.',
    createdAt: minsAgo(15),
    read: false,
  },
  {
    id: 'N003',
    type: 'success',
    title: 'Charging Complete',
    description: 'Vehicle VEGO-008 has been fully charged at Downtown Hub.',
    createdAt: minsAgo(60),
    read: false,
  },
  {
    id: 'N004',
    type: 'info',
    title: 'New Driver Assignment',
    description: 'Driver Ahmed Al-Qahtani has been assigned to Vehicle VEGO-022.',
    createdAt: minsAgo(120),
    read: true,
  },
  {
    id: 'N005',
    type: 'error',
    title: 'Station Offline',
    description: "Charging Station 'Mall Charging Point' is currently offline.",
    createdAt: minsAgo(180),
    read: false,
  },
  {
    id: 'N006',
    type: 'warning',
    title: 'Speed Violation',
    description: 'Vehicle VEGO-012 exceeded speed limit in School Slow Zone.',
    createdAt: minsAgo(240),
    read: true,
  },
  {
    id: 'N007',
    type: 'success',
    title: 'Battery Swap Complete',
    description: 'Vehicle VEGO-005 battery successfully swapped at Central Station.',
    createdAt: minsAgo(300),
    read: false,
  },
  {
    id: 'N008',
    type: 'alert',
    title: 'Vehicle Inactive',
    description: 'Vehicle VEGO-019 has been inactive for over 3 hours.',
    createdAt: minsAgo(360),
    read: false,
  },
  {
    id: 'N009',
    type: 'info',
    title: 'Zone Rule Updated',
    description: 'Speed limit in Downtown District zone has been updated to 45 km/h.',
    createdAt: minsAgo(480),
    read: true,
  },
  {
    id: 'N010',
    type: 'success',
    title: 'Fleet Daily Report Ready',
    description: 'Daily fleet performance report for May 13, 2026 is now available.',
    createdAt: minsAgo(1440),
    read: true,
  },
];
