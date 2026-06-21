// ============================================================================
// Domain Types — central contract for the entire application
// ============================================================================

export type VehicleStatus = 'active' | 'charging' | 'idle' | 'maintenance';
export type StationStatus = 'available' | 'charging' | 'in_use';
export type DriverStatus = 'active' | 'inactive' | 'pending' | 'blocked';
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

export type DocumentStatus = 'not_uploaded' | 'pending' | 'verified' | 'rejected';

export interface DriverDocuments {
  license: {
    status: DocumentStatus;
    hasLicense: boolean;
    number?: string;
    expiryDate?: string;
  };
  customsCard: {
    status: DocumentStatus;
  };
  plate: {
    status: DocumentStatus;
    number?: string;
  };
}

export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DriverRegistrationRequest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  requestedAt: string;
  status: RegistrationRequestStatus;
  documents: DriverDocuments;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  vehicleModel: string;
  status: DriverStatus;
  trips: number;
  totalCost: number;
  charges: number;
  swaps: number;
  walletBalance: number;
  avatarUrl?: string;
  documents: DriverDocuments;
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

export type ZoneType = 'normal' | 'slow' | 'restricted';

export interface ZonePoint {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  /** Display name — equals name_en for convenience. */
  name: string;
  name_en: string;
  name_ar: string;
  type: ZoneType;
  /** Maximum allowed speed inside the zone, in km/h. 0 means "no riding" allowed. */
  speedLimitKmh: number;
  /** Whether the zone rules are currently being enforced. */
  active: boolean;
  /** Frontend-only — whether the zone polygon is visible on the map. */
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
  // Additional counters from GET /fleet-admin/dashboard
  totalDrivers: number;
  activeTrips: number;
  unresolvedAlarms: number;
  onlineDevices: number;
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

// ----- Wallet ----------------------------------------------------------------

export type TransactionType   = 'top_up' | 'fast_charge' | 'battery_swap' | 'refund';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export interface WalletTransaction {
  id: string;
  createdAt: string;
  driverName: string;
  driverId: string;
  /** Positive = top-up credit, negative = debit (charge / swap) */
  amount: number;
  type: TransactionType;
  paymentMethod?: string;
  note?: string;
  status: TransactionStatus;
  adminName?: string;
}

export interface WalletStats {
  totalTopUps: number;
  totalSpent: number;
  avgPerDriver: number;
  topUpTrend: number;   // %
  budgetUsedPercent: number;
  activeDriversCount: number;
}

// ----- Battery Swapping -------------------------------------------------------

export interface SwappingStation {
  id: string;
  cabinetId: string;
  name: string;
  district: string;
  city: string;
  coordinates: { lat: number; lng: number };
  readyBatteries: number;
  chargingBatteries: number;
  emptySlots: number;
  totalCapacity: number;
  avgWaitTimeMinutes: number;
  todaySwaps: number;
}

// ----- Fast Charging ----------------------------------------------------------

export type FastChargingStatus = 'operational' | 'high_demand' | 'error';

export interface FastChargingCabinet {
  id: string;
  cabinetId: string;
  name: string;
  district: string;
  city: string;
  coordinates: { lat: number; lng: number };
  availablePorts: number;
  chargingPorts: number;
  errorPorts: number;
  totalPorts: number;
  avgChargeTimeMinutes: number;
  todaySessions: number;
  status: FastChargingStatus;
}
