import type {
  BatteryDistribution,
  BatteryHealthPoint,
  CostBreakdown,
  DashboardMetrics,
  RevenuePoint,
  UsagePoint,
} from '@/types';

export const mockMetrics: DashboardMetrics = {
  activeFleet: 7,
  availableBatteries: 35,
  totalTripsToday: 234,
  avgTripDurationMinutes: 24,
  chargingBatteries: 3,
  averageSoc: 68,
  lowBatteryCount: 5,
  averageCostPerVehicle: 5,
  successRate: 98.5,
  fleetTrend: 12,
  batteriesTrend: 5,
  tripsTrend: 18,
  durationTrend: -2,
};

export const mockUsage: UsagePoint[] = [
  { hour: '00:00', value: 12 },
  { hour: '03:00', value: 8 },
  { hour: '06:00', value: 15 },
  { hour: '09:00', value: 42 },
  { hour: '12:00', value: 65 },
  { hour: '15:00', value: 78 },
  { hour: '18:00', value: 95 },
  { hour: '21:00', value: 58 },
];

export const mockBatteryHealth: BatteryHealthPoint[] = [
  { month: 'Jan', health: 95 },
  { month: 'Feb', health: 93 },
  { month: 'Mar', health: 92 },
  { month: 'Apr', health: 93 },
  { month: 'May', health: 90 },
  { month: 'Jun', health: 88 },
];

export const mockWeeklyTrips: { day: string; trips: number; revenue: number }[] = [
  { day: 'Mo', trips: 180, revenue: 920 },
  { day: 'Tu', trips: 220, revenue: 1080 },
  { day: 'We', trips: 290, revenue: 1284 },
  { day: 'Th', trips: 380, revenue: 1620 },
  { day: 'Fr', trips: 510, revenue: 2080 },
  { day: 'Sa', trips: 460, revenue: 1880 },
  { day: 'Su', trips: 340, revenue: 1490 },
];

export const mockMonthlyRevenue: RevenuePoint[] = [
  { date: 'Jan', revenue: 28000, trips: 850 },
  { date: 'Feb', revenue: 42000, trips: 1240 },
  { date: 'Mar', revenue: 51000, trips: 1580 },
  { date: 'Apr', revenue: 38000, trips: 1180 },
];

export const mockBatteryDistribution: BatteryDistribution[] = [
  { range: '80-100%', percentage: 30, color: '#10b981' },
  { range: '60-80%', percentage: 28, color: '#3b82f6' },
  { range: '40-60%', percentage: 22, color: '#f59e0b' },
  { range: '20-40%', percentage: 12, color: '#fb923c' },
  { range: '0-20%', percentage: 8, color: '#ef4444' },
];

export const mockCostAnalysis: CostBreakdown[] = [
  { category: 'Battery Swaps', value: 345.5, color: '#3b82f6' },
  { category: 'Fast Charging', value: 856.0, color: '#10b981' },
  { category: 'Penalties', value: 345.5, color: '#f59e0b' },
];

export const mockTopDrivers = [
  { name: 'Saud Al-Harbi', earnings: 345.5, swaps: 42, charges: 18, dropOff: 89 },
  { name: 'Majid Al-Ghamdi', earnings: 345.5, swaps: 42, charges: 18, dropOff: 44 },
  { name: 'Ahmed Al-Khaldi', earnings: 345.5, swaps: 42, charges: 18, dropOff: 22 },
  { name: 'Khalid Al-Mutairi', earnings: 345.5, swaps: 42, charges: 18, dropOff: 67 },
];
