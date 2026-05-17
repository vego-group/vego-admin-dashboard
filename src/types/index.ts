// ============================================================================
// Domain Types — central contract for the entire application
// ============================================================================

export type VehicleStatus = 'active' | 'charging' | 'idle' | 'maintenance';
export type StationStatus = 'available' | 'charging' | 'in_use';
export type DriverStatus = 'active' | 'on_leave' | 'inactive';
export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';
export type UserRole = 'admin' | 'operator';

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: 'VegoMax Pro' | 'VegoLite' | 'VEGO Pro 400' | 'VEGO Cargo 500';
  status: VehicleStatus;
  batteryLevel: number;
  location: string;
  coordinates: { lat: number; lng: number };
  assignedDriverId?: string;
  assignedDriverName?: string;
  lastTripAt: string;
  totalDistanceKm: number;
  currentSpeedKmh: number;
  estimatedRangeKm: number;
  speedLimitKmh: number;
  isLocked: boolean;
  isEngineRunning: boolean;
  gpsSignal: 'strong' | 'weak' | 'none';
  isOnline: boolean;
}

export interface BatteryStation {
  id: string;
  name: string;
  district: string;
  city: string;
  coordinates: { lat: number; lng: number };
  available: number;
  charging: number;
  inUse: number;
  totalCapacity: number;
  avgWaitTimeMinutes: number;
  todaySwaps: number;
  type: 'swap' | 'fast_charge';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleModel: string;
  status: DriverStatus;
  trips: number;
  totalCost: number;
  charges: number;
  swaps: number;
  avatarUrl?: string;
}

// ----- Notifications ----------------------------------------------------------

export type NotificationType = 'alert' | 'warning' | 'success' | 'info' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
}

// ----- Zone Control -----------------------------------------------------------

export type ZoneType = 'operational' | 'no_ride' | 'slow' | 'parking';

export interface ZonePoint {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  /** Maximum allowed speed inside the zone, in km/h. 0 means "no riding" allowed. */
  speedLimitKmh: number;
  /** Whether the zone rules are currently being enforced. */
  active: boolean;
  /** Whether the zone is shown on the map (toggled by the eye icon). */
  visible: boolean;
  /** Closed polygon. Minimum 3 points to be a valid zone. */
  polygon: ZonePoint[];
  createdAt: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  startedAt: string;
  endedAt?: string;
  distanceKm: number;
  durationMinutes: number;
  startLocation: string;
  endLocation: string;
  cost: number;
}

export interface DashboardMetrics {
  activeFleet: number;
  availableBatteries: number;
  totalTripsToday: number;
  avgTripDurationMinutes: number;
  chargingBatteries: number;
  averageSoc: number;
  lowBatteryCount: number;
  averageCostPerVehicle: number;
  successRate: number;
  fleetTrend: number;
  batteriesTrend: number;
  tripsTrend: number;
  durationTrend: number;
}

export interface UsagePoint {
  hour: string;
  value: number;
}

export interface BatteryHealthPoint {
  month: string;
  health: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  trips: number;
}

export interface CostBreakdown {
  category: string;
  value: number;
  color: string;
}

export interface BatteryDistribution {
  range: string;
  percentage: number;
  color: string;
}

export interface AlertItem {
  id: string;
  type: 'low_battery' | 'maintenance' | 'inactive' | 'info';
  title: string;
  description: string;
  vehicleId?: string;
  createdAt: string;
  read: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}
