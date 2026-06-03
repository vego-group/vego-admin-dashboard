/**
 * Fleet Admin API layer.
 *
 * Every function maps the raw backend response to the frontend types defined
 * in @/types.  All HTTP work is delegated to apiClient (which automatically
 * attaches the Bearer token from the auth store).
 *
 * Backend base: NEXT_PUBLIC_API_URL  (e.g. https://api.myvego.com/api)
 * Auth prefix:  /fleet-admin/*
 */

import { apiClient } from '@/lib/api/client';
import type {
  BatteryDistribution,
  BatteryHealthPoint,
  BatteryStation,
  CostBreakdown,
  DashboardMetrics,
  Driver,
  DriverDocuments,
  DriverRegistrationRequest,
  FastChargingCabinet,
  FastChargingStatus,
  Notification,
  NotificationType,
  RevenuePoint,
  SwappingStation,
  UsagePoint,
  Vehicle,
  VehicleStatus,
  WalletStats,
  WalletTransaction,
  Zone,
  ZonePoint,
  ZoneType,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Raw API response shapes (backend contract)
// ─────────────────────────────────────────────────────────────────────────────


interface ApiDriver {
  id: number | string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // Status — backend uses "active" | "inactive" | "on_leave"
  status?: string;
  // Account approval status — "approved" | "rejected" | null (null = created directly by fleet admin)
  account_status?: string | null;
  account_type?: string;
  fleet_id?: number;
  // Flat license fields — real API returns these directly in list & show
  driving_license_number?: string | null;
  driving_license_file?: string | null;
  has_license?: boolean;
  // Motorcycle — list returns assigned_motorcycle, show returns motorcycle
  assigned_motorcycle?: { id?: number; model_name?: string; model?: string; plate_number?: string } | null;
  motorcycle?: { model_name?: string; model?: string; plate_number?: string } | null;
  // Stats — not present in list/show response yet; will be 0 until backend adds them
  trips_count?: number;
  total_cost?: number;
  charges_count?: number;
  swaps_count?: number;
  // Wallet balance — list response includes flat wallet_balance (SAR)
  wallet_balance?: number;
  wallet?: { balance_sar?: number; balance?: number };
  // Legacy nested shapes (older API / show endpoint)
  driving_license?: {
    status?: string;
    license_number?: string;
    expiry_date?: string;
    has_license?: boolean;
  };
  plate?: { status?: string; plate_number?: string };
  customs_card?: { status?: string };
}

interface ApiMotorcycle {
  id: number | string;
  plate_number?: string;
  model_name?: string;
  model?: string;
  status?: string;
  battery?: { soc_pct?: number; soh_pct?: number };
  iot_device?: {
    latitude?: number;
    longitude?: number;
    speed_kmh?: number;
    is_online?: boolean;
    gps_signal?: string;
  };
  driver?: { id: number | string; name: string };
  last_trip_at?: string;
  total_distance_km?: number;
  estimated_range_km?: number;
  speed_limit_kmh?: number;
  is_locked?: boolean;
  is_engine_running?: boolean;
}

interface ApiCabinet {
  id: number | string;
  // Display ID — backend returns cabinet_id string (e.g. "MXS202409200001")
  cabinet_id?: string;
  name?: string;
  // Location — real API uses address + city + province
  address?: string;
  location?: string;
  district?: string;
  city?: string;
  province?: string;
  // Coordinates — real API returns lat/lng as strings
  lat?: string | number;
  lng?: string | number;
  latitude?: number;
  longitude?: number;
  // Status — real API uses status ("active"|"inactive"|"maintenance")
  status?: string;
  live_status?: string;
  unavailable_reason?: string;
  // Battery counts — real API uses these field names directly
  ready_batteries?: number;
  charging_batteries?: number;
  empty_slots?: number;
  total_capacity?: number;
  // Legacy field names (older API shape)
  ready_batteries_count?: number;
  charging_batteries_count?: number;
  empty_slots_count?: number;
  total_slots?: number;
  // Stats
  avg_wait_time_minutes?: number;
  avg_wait_minutes?: number;
  today_swaps?: number;
  today_swaps_count?: number;
}

interface ApiPile {
  id: number | string;
  // Identifiers — backend uses pile_id in list; dev_id in older shape
  pile_id?: string;
  dev_id?: string;
  name?: string;
  // Location — backend returns address + city + province; older shape had location/district
  address?: string;
  location?: string;
  district?: string;
  city?: string;
  province?: string;
  // Coordinates — backend returns lat/lng strings; older shape used latitude/longitude numbers
  lat?: string | number;
  lng?: string | number;
  latitude?: number;
  longitude?: number;
  // Status — backend uses status ("active"|"inactive"|"maintenance"); older shape used live_status
  status?: string;
  live_status?: string;
  // Port counts — returned pre-computed in the list response
  available_ports?: number;
  charging_ports?: number;
  error_ports?: number;
  total_ports?: number;
  // Chargers array — only present in the single-item (show) response
  chargers?: { id: number; port_no?: number; charger_no?: number; status: string; available?: boolean }[];
  charger_count?: number;
  // Stats
  today_sessions?: number;
  today_sessions_count?: number;
  avg_charge_time_minutes?: number;
}

interface ApiTransaction {
  id: number | string;
  created_at?: string;
  /** Backend sends "credit" | "debit" (or legacy "top_up" | "charging" | "swap") */
  type?: string;
  amount_sar?: number;
  /** Backend returns amount as a string e.g. "100.00" */
  amount?: number | string;
  status?: string;
  description?: string;
  note?: string;
  payment_method?: string;
  reference_type?: string | null;
  /** Driver may be directly on the transaction or nested inside wallet */
  user?: { id: number | string; name: string };
  driver?: { id: number | string; name: string };
  admin?: { name: string };
  wallet?: {
    id?: number | string;
    user?: { id: number | string; name: string; phone?: string };
  };
}

interface ApiNotification {
  id: number | string;
  type?: string;
  title?: string;
  body?: string;
  message?: string;
  created_at?: string;
  read_at?: string | null;
}

interface ApiRegistrationRequest {
  id: number | string;
  user_id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  requested_at?: string;
  account_status?: string;
  status?: string;
  driving_license?: {
    status?: string;
    license_number?: string;
    expiry_date?: string;
  };
  plate?: { status?: string; plate_number?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

function toDocStatus(s?: string): 'not_uploaded' | 'pending' | 'verified' | 'rejected' {
  if (s === 'approved') return 'verified';
  if (s === 'pending')  return 'pending';
  if (s === 'rejected') return 'rejected';
  return 'not_uploaded';
}

function toDriverStatus(s?: string): Driver['status'] {
  if (s === 'active')   return 'active';
  if (s === 'inactive') return 'inactive';
  if (s === 'pending')  return 'pending';
  if (s === 'blocked')  return 'blocked';
  // Legacy: on_leave → inactive
  return 'inactive';
}

function toVehicleStatus(s?: string): VehicleStatus {
  if (s === 'active')      return 'active';
  if (s === 'charging')    return 'charging';
  if (s === 'maintenance') return 'maintenance';
  return 'idle';
}

function toFcStatus(s?: string): FastChargingStatus {
  // Real backend values: active | inactive | maintenance
  // Legacy values: busy | high_demand | unavailable | error
  if (s === 'maintenance' || s === 'inactive' || s === 'unavailable' || s === 'error') return 'error';
  if (s === 'busy' || s === 'high_demand') return 'high_demand';
  return 'operational'; // active → operational
}

function toNotificationType(s?: string): NotificationType {
  if (s === 'warning') return 'warning';
  if (s === 'success') return 'success';
  if (s === 'error')   return 'error';
  if (s === 'info')    return 'info';
  return 'alert';
}

function mapDriver(d: ApiDriver): Driver {
  // Real API returns flat fields; older/show endpoint may use nested shapes
  const license = d.driving_license;
  const plate   = d.plate;
  const customs = d.customs_card;

  // License status: prefer nested object; fall back to flat fields
  const hasLicense   = d.has_license ?? license?.has_license ?? !!license;
  const licenseNum   = license?.license_number ?? d.driving_license_number ?? undefined;
  const licenseFile  = d.driving_license_file;
  const licenseStatus =
    license?.status
      ? toDocStatus(license.status)
      : licenseNum || licenseFile
        ? 'verified'
        : hasLicense
          ? 'pending'
          : 'not_uploaded';

  const documents: DriverDocuments = {
    license: {
      status:     licenseStatus,
      hasLicense,
      number:     licenseNum,
      expiryDate: license?.expiry_date,
    },
    customsCard: { status: toDocStatus(customs?.status) },
    plate: {
      status: toDocStatus(plate?.status),
      number: plate?.plate_number,
    },
  };

  // Motorcycle: list returns assigned_motorcycle; show returns motorcycle
  const moto = d.assigned_motorcycle ?? d.motorcycle;

  return {
    id:           String(d.id),
    name:         d.name,
    phone:        d.phone,
    email:        d.email    ?? undefined,
    address:      d.address  ?? undefined,
    city:         d.city     ?? undefined,
    vehicleModel: moto?.model_name ?? moto?.model ?? '',
    status:       toDriverStatus(d.status),
    trips:        d.trips_count ?? 0,
    totalCost:    d.total_cost ?? 0,
    charges:      d.charges_count ?? 0,
    swaps:        d.swaps_count ?? 0,
    walletBalance: d.wallet_balance ?? d.wallet?.balance_sar ?? d.wallet?.balance ?? 0,
    documents,
  };
}

function mapMotorcycle(m: ApiMotorcycle): Vehicle {
  const iot = m.iot_device;
  return {
    id:                 String(m.id),
    plateNumber:        m.plate_number ?? `VH-${m.id}`,
    model:              (m.model_name ?? m.model ?? 'VegoMax Pro') as Vehicle['model'],
    status:             toVehicleStatus(m.status),
    batteryLevel:       m.battery?.soc_pct ?? 0,
    location:           '',
    coordinates:        { lat: iot?.latitude ?? 24.7136, lng: iot?.longitude ?? 46.6753 },
    assignedDriverId:   m.driver ? String(m.driver.id) : undefined,
    assignedDriverName: m.driver?.name,
    lastTripAt:         m.last_trip_at ?? new Date().toISOString(),
    totalDistanceKm:    m.total_distance_km ?? 0,
    currentSpeedKmh:    iot?.speed_kmh ?? 0,
    estimatedRangeKm:   m.estimated_range_km ?? 0,
    speedLimitKmh:      m.speed_limit_kmh ?? 80,
    isLocked:           m.is_locked ?? false,
    isEngineRunning:    m.is_engine_running ?? false,
    gpsSignal:          (iot?.gps_signal as Vehicle['gpsSignal']) ?? 'strong',
    isOnline:           iot?.is_online ?? false,
  };
}

function mapCabinet(c: ApiCabinet): SwappingStation {
  // Coordinates: backend returns lat/lng as strings ("24.71360000")
  const lat = typeof c.lat === 'string' ? parseFloat(c.lat) : (c.lat ?? c.latitude ?? 24.7136);
  const lng = typeof c.lng === 'string' ? parseFloat(c.lng) : (c.lng ?? c.longitude ?? 46.6753);

  return {
    id:                 String(c.id),
    cabinetId:          c.cabinet_id ?? `#CF-${String(c.id).padStart(4, '0')}`,
    name:               c.name ?? `Cabinet ${c.id}`,
    district:           c.district ?? c.address ?? c.location ?? '',
    city:               c.city ?? 'Riyadh',
    coordinates:        { lat, lng },
    readyBatteries:     c.ready_batteries     ?? c.ready_batteries_count     ?? 0,
    chargingBatteries:  c.charging_batteries  ?? c.charging_batteries_count  ?? 0,
    emptySlots:         c.empty_slots         ?? c.empty_slots_count         ?? 0,
    totalCapacity:      c.total_capacity      ?? c.total_slots               ?? 0,
    avgWaitTimeMinutes: c.avg_wait_time_minutes ?? c.avg_wait_minutes        ?? 0,
    todaySwaps:         c.today_swaps         ?? c.today_swaps_count         ?? 0,
  };
}

function mapPile(p: ApiPile): FastChargingCabinet {
  // The list endpoint returns pre-computed port counts directly.
  // The show endpoint also includes a chargers[] array — use it as fallback.
  const chargers = p.chargers ?? [];

  const available  = p.available_ports
    ?? chargers.filter((c) => c.status === 'free' || c.status === 'available' || c.available === true).length;
  const charging   = p.charging_ports
    ?? chargers.filter((c) => c.status === 'busy' || c.status === 'charging').length;
  const error      = p.error_ports
    ?? chargers.filter((c) => c.status === 'error' || c.status === 'maintenance' || c.status === 'offline').length;
  const totalPorts = p.total_ports
    ?? (chargers.length || (p.charger_count ?? 0));

  // Coordinates: backend returns lat/lng as strings ("24.71400000")
  const lat = typeof p.lat === 'string' ? parseFloat(p.lat) : (p.lat ?? p.latitude ?? 24.7136);
  const lng = typeof p.lng === 'string' ? parseFloat(p.lng) : (p.lng ?? p.longitude ?? 46.6753);

  return {
    id:                   String(p.id),
    cabinetId:            p.pile_id ?? p.dev_id ?? `FC-${String(p.id).padStart(5, '0')}`,
    name:                 p.name ?? `Pile ${p.id}`,
    district:             p.district ?? p.address ?? p.location ?? '',
    city:                 p.city ?? 'Riyadh',
    coordinates:          { lat, lng },
    availablePorts:       available,
    chargingPorts:        charging,
    errorPorts:           error,
    totalPorts,
    avgChargeTimeMinutes: p.avg_charge_time_minutes ?? 0,
    todaySessions:        p.today_sessions ?? p.today_sessions_count ?? 0,
    status:               toFcStatus(p.status ?? p.live_status),
  };
}

function mapTransaction(tx: ApiTransaction): WalletTransaction {
  const rawType = tx.type ?? '';
  let type: WalletTransaction['type'] = 'top_up';
  if (rawType === 'debit') {
    // debit transactions are spending — use reference_type to distinguish
    const ref = tx.reference_type ?? '';
    type = (ref === 'fast_charge' || ref === 'fast_charging' || ref === 'charging') ? 'fast_charge' : 'battery_swap';
  } else if (rawType === 'fast_charging' || rawType === 'fast_charge' || rawType === 'charging') {
    type = 'fast_charge';
  } else if (rawType === 'swap' || rawType === 'battery_swap') {
    type = 'battery_swap';
  } else if (rawType === 'refund') {
    type = 'refund';
  }
  // "credit" or "top_up" stays as 'top_up'

  // Driver may be nested under wallet.user, or directly on tx.user / tx.driver
  const driver = tx.wallet?.user ?? tx.user ?? tx.driver;

  // Backend sends amount as string "100.00" — always parse to number
  const rawAmount = tx.amount_sar ?? tx.amount ?? 0;
  const amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

  return {
    id:            String(tx.id),
    createdAt:     tx.created_at ?? new Date().toISOString(),
    driverId:      String(driver?.id ?? ''),
    driverName:    driver?.name ?? '',
    amount,
    type,
    paymentMethod: tx.payment_method,
    note:          tx.note ?? tx.description,
    status:        (tx.status as WalletTransaction['status']) ?? 'completed',
    adminName:     tx.admin?.name,
  };
}

function mapNotification(n: ApiNotification): Notification {
  return {
    id:          String(n.id),
    type:        toNotificationType(n.type),
    title:       n.title ?? 'Notification',
    description: n.body ?? n.message ?? '',
    createdAt:   n.created_at ?? new Date().toISOString(),
    read:        !!n.read_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fleet API
// ─────────────────────────────────────────────────────────────────────────────

/** Safely extract a list from any of: T[], { data: T[] }, { data: { data: T[] } } */
function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj['data'])) return obj['data'] as T[];
    if (obj['data'] && typeof obj['data'] === 'object') {
      const inner = obj['data'] as Record<string, unknown>;
      if (Array.isArray(inner['data'])) return inner['data'] as T[];
    }
  }
  return [];
}

// Shape returned by getBattery()
export interface MotorcycleBattery {
  level: number;          // soc_pct  0-100
  sohPct?: number;        // state-of-health %
  rangeKm: number;        // estimated_range_km
  voltage?: number;
  temperature?: number;
}

// Shape returned by getStatistics()
export interface MotorcycleStatistics {
  trips: number;
  swaps: number;
  alarms: number;
  totalDistanceKm: number;
}

export const fleetApi = {
  async list(): Promise<Vehicle[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/motorcycles');
    return extractList<ApiMotorcycle>(raw).map(mapMotorcycle);
  },

  async getById(id: string): Promise<Vehicle | null> {
    try {
      const res = await apiClient.get<{ data?: ApiMotorcycle } | ApiMotorcycle>(
        `/fleet-admin/motorcycles/${id}`,
      );
      const raw = (res as { data?: ApiMotorcycle }).data ?? (res as ApiMotorcycle);
      return mapMotorcycle(raw);
    } catch {
      return null;
    }
  },

  /** Real-time battery state + latest log */
  async getBattery(id: string): Promise<MotorcycleBattery | null> {
    try {
      const res = await apiClient.get<unknown>(`/fleet-admin/motorcycles/${id}/battery`);
      const obj = res as Record<string, unknown>;
      const d   = (obj.data && typeof obj.data === 'object'
        ? obj.data : obj) as Record<string, unknown>;
      return {
        level:       Number(d.soc_pct       ?? d.battery_level  ?? 0),
        sohPct:      d.soh_pct       != null ? Number(d.soh_pct)       : undefined,
        rangeKm:     Number(d.estimated_range_km ?? d.range_km ?? 0),
        voltage:     d.voltage       != null ? Number(d.voltage)       : undefined,
        temperature: d.temperature   != null ? Number(d.temperature)   : undefined,
      };
    } catch {
      return null;
    }
  },

  /** Trip / swap / alarm statistics for a motorcycle */
  async getStatistics(id: string): Promise<MotorcycleStatistics | null> {
    try {
      const res = await apiClient.get<unknown>(`/fleet-admin/motorcycles/${id}/statistics`);
      const obj = res as Record<string, unknown>;
      const d   = (obj.data && typeof obj.data === 'object'
        ? obj.data : obj) as Record<string, unknown>;
      return {
        trips:           Number(d.trips_count          ?? d.total_trips  ?? d.trips  ?? 0),
        swaps:           Number(d.swap_sessions_count  ?? d.total_swaps  ?? d.swaps  ?? 0),
        alarms:          Number(d.alarms_count         ?? d.total_alarms ?? d.alarms ?? 0),
        totalDistanceKm: Number(d.total_distance_km    ?? d.distance_km  ?? 0),
      };
    } catch {
      return null;
    }
  },

  /** Assign a driver — body: { user_id } */
  async assignDriver(motorcycleId: string, driverId: string): Promise<boolean> {
    try {
      await apiClient.post(
        `/fleet-admin/motorcycles/${motorcycleId}/assign-driver`,
        { user_id: Number(driverId) },
      );
      return true;
    } catch {
      return false;
    }
  },

  /** Unassign the current driver */
  async unassignDriver(motorcycleId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/fleet-admin/motorcycles/${motorcycleId}/assign-driver`);
      return true;
    } catch {
      return false;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stations API (legacy BatteryStation used by the live map)
// ─────────────────────────────────────────────────────────────────────────────

export const stationsApi = {
  async list(): Promise<BatteryStation[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/cabinets');
    return extractList<ApiCabinet>(raw).map((c) => {
      const lat = typeof c.lat === 'string' ? parseFloat(c.lat) : (c.lat ?? c.latitude ?? 24.7136);
      const lng = typeof c.lng === 'string' ? parseFloat(c.lng) : (c.lng ?? c.longitude ?? 46.6753);
      return {
        id:                 String(c.id),
        name:               c.name ?? `Cabinet ${c.id}`,
        district:           c.district ?? c.address ?? c.location ?? '',
        city:               c.city ?? 'Riyadh',
        coordinates:        { lat, lng },
        available:          c.ready_batteries    ?? c.ready_batteries_count    ?? 0,
        charging:           c.charging_batteries ?? c.charging_batteries_count ?? 0,
        inUse:              0,
        totalCapacity:      c.total_capacity     ?? c.total_slots              ?? 0,
        avgWaitTimeMinutes: c.avg_wait_time_minutes ?? c.avg_wait_minutes      ?? 0,
        todaySwaps:         c.today_swaps        ?? c.today_swaps_count        ?? 0,
        type:               'swap' as const,
      };
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Drivers API
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverCreateInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  vehicleModel: string;
  status: Driver['status'];
  documents?: DriverDocuments;
}

export type DriverUpdateInput = Partial<DriverCreateInput>;

export const driversApi = {
  async list(): Promise<Driver[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/drivers');
    return extractList<ApiDriver>(raw).map(mapDriver);
  },

  async create(input: DriverCreateInput): Promise<Driver> {
    // POST /fleet-admin/drivers — only send fields the backend accepts
    const body: Record<string, string | undefined> = {
      name:  input.name,
      phone: input.phone,
    };
    if (input.email)                             body['email']                  = input.email;
    if (input.address)                           body['address']                = input.address;
    if (input.city)                              body['city']                   = input.city;
    if (input.documents?.license?.number)        body['driving_license_number'] = input.documents.license.number;
    if (input.documents?.license?.expiryDate)    body['driving_license_expiry'] = input.documents.license.expiryDate;
    if (input.documents?.plate?.number)          body['plate_number']           = input.documents.plate.number;

    const res = await apiClient.post<{ data: ApiDriver } | ApiDriver>('/fleet-admin/drivers', body);
    // Handle both { data: ApiDriver } and flat ApiDriver responses
    const raw = (res as { data?: ApiDriver }).data ?? (res as ApiDriver);
    return mapDriver(raw);
  },

  async update(id: string, updates: DriverUpdateInput): Promise<Driver | null> {
    try {
      // PUT /fleet-admin/drivers/:id — send updatable fields only
      const body: Record<string, string | undefined> = {};
      if (updates.name)    body['name']    = updates.name;
      if (updates.email)   body['email']   = updates.email;
      if (updates.address) body['address'] = updates.address;
      if (updates.city)    body['city']    = updates.city;
      if (updates.documents?.license?.number) body['driving_license_number'] = updates.documents.license.number;

      const res = await apiClient.put<{ data: ApiDriver } | ApiDriver>(`/fleet-admin/drivers/${id}`, body);
      const raw = (res as { data?: ApiDriver }).data ?? (res as ApiDriver);
      return mapDriver(raw);
    } catch {
      return null;
    }
  },

  /** Toggle active ↔ inactive. Returns the new status string, or null on error. */
  async toggleStatus(id: string): Promise<string | null> {
    try {
      const res = await apiClient.patch<{ data?: { id: number | string; status: string } }>(
        `/fleet-admin/drivers/${id}/toggle-status`,
      );
      return res.data?.status ?? null;
    } catch {
      return null;
    }
  },

  /** Block a driver. Returns the new status ('blocked') or null on error. */
  async block(id: string): Promise<string | null> {
    try {
      const res = await apiClient.patch<{ data?: { id: number | string; status: string } }>(
        `/fleet-admin/drivers/${id}/block`,
      );
      return res.data?.status ?? null;
    } catch {
      return null;
    }
  },

  /** Unblock a driver. Returns the new status ('active') or null on error. */
  async unblock(id: string): Promise<string | null> {
    try {
      const res = await apiClient.patch<{ data?: { id: number | string; status: string } }>(
        `/fleet-admin/drivers/${id}/unblock`,
      );
      return res.data?.status ?? null;
    } catch {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registration Requests API
// ─────────────────────────────────────────────────────────────────────────────

function mapRegistrationRequest(r: ApiRegistrationRequest): DriverRegistrationRequest {
  const fullName = r.name ?? [r.first_name, r.last_name].filter(Boolean).join(' ');
  const licStatus = toDocStatus(r.driving_license?.status);
  const plStatus  = toDocStatus(r.plate?.status);
  const docs: DriverDocuments = {
    license: {
      status:     licStatus,
      hasLicense: !!r.driving_license,
      number:     r.driving_license?.license_number,
      expiryDate: r.driving_license?.expiry_date,
    },
    customsCard: { status: 'not_uploaded' },
    plate: {
      status: plStatus,
      number: r.plate?.plate_number,
    },
  };

  const reqStatus: DriverRegistrationRequest['status'] =
    r.account_status === 'approved' || r.status === 'approved' ? 'approved'
    : r.account_status === 'rejected' || r.status === 'rejected' ? 'rejected'
    : 'pending';

  return {
    id:          String(r.id),
    name:        fullName,
    phone:       r.phone ?? '',
    email:       r.email,
    requestedAt: r.requested_at ?? r.created_at ?? new Date().toISOString(),
    status:      reqStatus,
    documents:   docs,
  };
}

export const registrationRequestsApi = {
  async list(): Promise<DriverRegistrationRequest[]> {
    const raw = await apiClient.get<unknown>(
      '/fleet-admin/registration-requests?status=under_review&per_page=50',
    );
    return extractList<ApiRegistrationRequest>(raw).map(mapRegistrationRequest);
  },

  async approve(req: DriverRegistrationRequest): Promise<Driver> {
    const res = await apiClient.post<{ data?: ApiDriver } | ApiDriver>(
      `/fleet-admin/registration-requests/${req.id}/approve`,
    );
    // Backend now returns the full driver object — try to use it
    const raw = (res as { data?: ApiDriver }).data ?? (res as ApiDriver);
    if (raw?.id) return mapDriver(raw as ApiDriver);
    // Fallback: synthesise from the registration request
    return {
      id:           req.id,
      name:         req.name,
      phone:        req.phone,
      email:        req.email,
      vehicleModel: '',
      status:       'active',
      trips:        0,
      totalCost:    0,
      charges:      0,
      swaps:        0,
      walletBalance: 0,
      documents:    req.documents,
    };
  },

  async reject(id: string, reason: string): Promise<void> {
    await apiClient.post(`/fleet-admin/registration-requests/${id}/reject`, { reason });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Zones API  (no backend endpoint yet — keep local state)
// ─────────────────────────────────────────────────────────────────────────────

export interface ZoneCreateInput {
  name: string;
  type: ZoneType;
  speedLimitKmh: number;
  active: boolean;
  polygon: ZonePoint[];
}

export type ZoneUpdateInput = Partial<Omit<ZoneCreateInput, 'polygon'>> & {
  polygon?: ZonePoint[];
  visible?: boolean;
};

// In-memory store for zones (no backend zone management endpoint yet)
const localZones: Zone[] = [];
let zoneCounter = 0;

function generateZoneId(): string {
  return `ZN${String(++zoneCounter).padStart(3, '0')}`;
}

export const zonesApi = {
  async list(): Promise<Zone[]> {
    return [...localZones];
  },

  async create(input: ZoneCreateInput): Promise<Zone> {
    const zone: Zone = {
      id:            generateZoneId(),
      name:          input.name,
      type:          input.type,
      speedLimitKmh: input.speedLimitKmh,
      active:        input.active,
      visible:       true,
      polygon:       input.polygon,
      createdAt:     new Date().toISOString(),
    };
    localZones.unshift(zone);
    return zone;
  },

  async update(id: string, updates: ZoneUpdateInput): Promise<Zone | null> {
    const index = localZones.findIndex((z) => z.id === id);
    if (index === -1) return null;
    localZones[index] = { ...localZones[index], ...updates };
    return localZones[index];
  },

  async remove(id: string): Promise<Zone | null> {
    const index = localZones.findIndex((z) => z.id === id);
    if (index === -1) return null;
    const [removed] = localZones.splice(index, 1);
    return removed;
  },

  async restore(zone: Zone, position: number): Promise<Zone> {
    localZones.splice(position, 0, zone);
    return zone;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard API
// ─────────────────────────────────────────────────────────────────────────────

interface ApiDashboard {
  total_motorcycles?: number;
  available_batteries?: number;
  charging_batteries?: number;
  low_battery_count?: number;
  /** Backend returns null when the fleet has no data yet */
  average_soc?: number | null;
  average_soh?: number | null;
  total_trips_today?: number;
  avg_trip_duration_minutes?: number;
  /** Backend returns null when no trips have occurred */
  success_rate?: number | null;
  average_cost_per_motorcycle?: number;
  // Confirmed new counters
  total_drivers?: number;
  active_trips?: number;
  unresolved_alarms?: number;
  online_devices?: number;
  // Real trend field names returned by the backend
  fleet_trend?: number;
  drivers_trend?: number;
  batteries_trend?: number;
  trips_trend?: number;
  duration_trend?: number;
  // Legacy names (kept as fallback in case API version changes)
  total_motorcycles_trend?: number;
  available_batteries_trend?: number;
  total_trips_today_trend?: number;
  avg_trip_duration_minutes_trend?: number;
}

interface ApiUsageBucket {
  hour?: number | string;
  label?: string;
  count?: number;
  value?: number;
}

interface ApiHealthPoint {
  month?: string;
  label?: string;
  avg_soh?: number;
  health?: number;
  value?: number;
}

export const dashboardApi = {
  async getMetrics(): Promise<DashboardMetrics> {
    const raw = await apiClient.get<{ data?: ApiDashboard } & ApiDashboard>('/fleet-admin/dashboard');
    // Backend may wrap in { data: {...} } or return the flat object directly
    const res: ApiDashboard = (raw.data && typeof raw.data === 'object') ? raw.data : raw;
    return {
      activeFleet:             res.total_motorcycles ?? 0,
      availableBatteries:      res.available_batteries ?? 0,
      chargingBatteries:       res.charging_batteries ?? 0,
      lowBatteryCount:         res.low_battery_count ?? 0,
      averageSoc:              res.average_soc ?? 0,
      totalTripsToday:         res.total_trips_today ?? 0,
      avgTripDurationMinutes:  res.avg_trip_duration_minutes ?? 0,
      successRate:             res.success_rate ?? 0,
      averageCostPerVehicle:   res.average_cost_per_motorcycle ?? 0,
      // Trend fields — backend uses short names (fleet_trend, batteries_trend…)
      // Fall back to legacy long names in case the API version changes
      fleetTrend:              res.fleet_trend     ?? res.total_motorcycles_trend         ?? 0,
      batteriesTrend:          res.batteries_trend ?? res.available_batteries_trend       ?? 0,
      tripsTrend:              res.trips_trend     ?? res.total_trips_today_trend         ?? 0,
      durationTrend:           res.duration_trend  ?? res.avg_trip_duration_minutes_trend ?? 0,
      // New counters from the dashboard endpoint
      totalDrivers:            res.total_drivers ?? 0,
      activeTrips:             res.active_trips ?? 0,
      unresolvedAlarms:        res.unresolved_alarms ?? 0,
      onlineDevices:           res.online_devices ?? 0,
    };
  },

  async getUsage(): Promise<UsagePoint[]> {
    const raw = await apiClient.get<{ data?: ApiUsageBucket[] } | ApiUsageBucket[]>('/fleet-admin/dashboard/usage');
    const list = Array.isArray(raw) ? raw : ((raw as { data?: ApiUsageBucket[] }).data ?? []);
    return list.map((b) => ({
      hour:  String(b.label ?? b.hour ?? ''),
      value: b.value ?? b.count ?? 0,
    }));
  },

  async getBatteryHealth(): Promise<BatteryHealthPoint[]> {
    const raw = await apiClient.get<{ data?: ApiHealthPoint[] } | ApiHealthPoint[]>(
      '/fleet-admin/dashboard/battery-health?months=6',
    );
    const list = Array.isArray(raw) ? raw : ((raw as { data?: ApiHealthPoint[] }).data ?? []);
    return list.map((p) => ({
      month:  p.label ?? p.month ?? '',
      health: p.avg_soh ?? p.health ?? p.value ?? 0,
    }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports API
// ─────────────────────────────────────────────────────────────────────────────

interface ApiWeeklyTrip {
  day?: string;
  label?: string;
  trips_count?: number;
  trips?: number;
  revenue_sar?: number;
  revenue?: number;
}

interface ApiMonthlyRevenue {
  month?: string;
  date?: string;
  label?: string;
  revenue_sar?: number;
  revenue?: number;
  trips_count?: number;
  trips?: number;
}

interface ApiBatteryBucket {
  range?: string;
  label?: string;
  percentage?: number;
  count?: number;
  color?: string;
}

interface ApiCostItem {
  category?: string;
  label?: string;
  amount_sar?: number;
  value?: number;
  color?: string;
}

interface ApiTopDriver {
  driver_id?: number | string;
  user_id?: number | string;
  name?: string;
  trips_count?: number;
  trips?: number;
  earnings_sar?: number;
  earnings?: number;
  swaps_count?: number;
  swaps?: number;
  charges_count?: number;
  charges?: number;
  drop_off?: number | null; // real field name from backend
  drop_off_pct?: number;
  dropOff?: number;
}

const COST_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const reportsApi = {
  async getWeeklyTrips(): Promise<{ day: string; trips: number; revenue: number }[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/weekly-trips');
    return extractList<ApiWeeklyTrip>(raw).map((r) => ({
      day:     r.label ?? r.day ?? '',
      trips:   r.trips_count ?? r.trips ?? 0,
      revenue: r.revenue_sar ?? r.revenue ?? 0,
    }));
  },

  async getMonthlyRevenue(): Promise<RevenuePoint[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/monthly-revenue');
    return extractList<ApiMonthlyRevenue>(raw).map((r) => ({
      date:    r.label ?? r.month ?? r.date ?? '',
      revenue: r.revenue_sar ?? r.revenue ?? 0,
      trips:   r.trips_count ?? r.trips ?? 0,
    }));
  },

  async getBatteryDistribution(): Promise<BatteryDistribution[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/battery-distribution');
    return extractList<ApiBatteryBucket>(raw).map((b, i) => ({
      range:      b.label ?? b.range ?? `Range ${i + 1}`,
      percentage: b.percentage ?? b.count ?? 0,
      color:      b.color ?? COST_COLORS[i % COST_COLORS.length],
    }));
  },

  async getCostAnalysis(): Promise<CostBreakdown[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/cost-analysis');
    return extractList<ApiCostItem>(raw).map((c, i) => ({
      category: c.label ?? c.category ?? `Category ${i + 1}`,
      value:    c.amount_sar ?? c.value ?? 0,
      color:    c.color ?? COST_COLORS[i % COST_COLORS.length],
    }));
  },

  async getTopDrivers(): Promise<
    { name: string; earnings: number; swaps: number; charges: number; dropOff: number }[]
  > {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/top-drivers?limit=10');
    return extractList<ApiTopDriver>(raw).map((d) => ({
      name:     d.name ?? 'Unknown',
      earnings: d.earnings_sar ?? d.earnings ?? 0,
      swaps:    d.swaps_count ?? d.swaps ?? 0,
      charges:  d.charges_count ?? d.charges ?? 0,
      dropOff:  d.drop_off ?? d.drop_off_pct ?? d.dropOff ?? 0,
    }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Battery Swapping API
// ─────────────────────────────────────────────────────────────────────────────

interface ApiSwapActivity {
  id?: string | number;
  type?: string;           // "swap" | "alert"
  driver_name?: string | null;
  cabinet_name?: string;
  battery_change_pct?: number;
  alert_type?: string;    // "offline" | "low_battery" | "error"
  occurred_at?: string;
}

export interface SwapActivity {
  id: string;
  type: 'swap' | 'alert';
  driverName: string | null;
  cabinetName: string;
  batteryChangePct?: number;
  alertType?: string;
  occurredAt: string;
}

export const swappingApi = {
  async list(): Promise<SwappingStation[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/cabinets');
    return extractList<ApiCabinet>(raw).map(mapCabinet);
  },

  async recentActivity(limit = 10): Promise<SwapActivity[]> {
    const raw = await apiClient.get<unknown>(
      `/fleet-admin/cabinets/recent-activity?limit=${limit}`,
    );
    return extractList<ApiSwapActivity>(raw).map((e) => ({
      id:              String(e.id ?? Math.random()),
      type:            e.type === 'alert' ? 'alert' : 'swap',
      driverName:      e.driver_name ?? null,
      cabinetName:     e.cabinet_name ?? '',
      batteryChangePct: e.battery_change_pct,
      alertType:       e.alert_type,
      occurredAt:      e.occurred_at ?? new Date().toISOString(),
    }));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fast Charging API
// ─────────────────────────────────────────────────────────────────────────────

export const fastChargingApi = {
  async list(): Promise<FastChargingCabinet[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/piles');
    return extractList<ApiPile>(raw).map(mapPile);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Wallet API
// ─────────────────────────────────────────────────────────────────────────────

interface ApiWalletStats {
  current_month_top_ups?: number;
  total_top_ups?: number;
  current_month_spent?: number;
  total_spent?: number;
  avg_per_driver?: number;
  top_up_trend_pct?: number;
  top_up_trend?: number;
  budget_used_pct?: number;
  budget_used_percent?: number;
  active_drivers_count?: number;
}

export const walletApi = {
  async getStats(): Promise<WalletStats> {
    const raw = await apiClient.get<{ data?: ApiWalletStats } & ApiWalletStats>('/fleet-admin/wallet/stats');
    // Backend wraps stats in { data: { ... } } — unwrap if present
    const s: ApiWalletStats = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data))
      ? raw.data
      : raw;
    return {
      totalTopUps:        s.current_month_top_ups ?? s.total_top_ups ?? 0,
      totalSpent:         s.current_month_spent   ?? s.total_spent   ?? 0,
      avgPerDriver:       s.avg_per_driver ?? 0,
      topUpTrend:         s.top_up_trend_pct ?? s.top_up_trend ?? 0,
      budgetUsedPercent:  s.budget_used_pct ?? s.budget_used_percent ?? 0,
      activeDriversCount: s.active_drivers_count ?? 0,
    };
  },

  async getTransactions(params?: {
    from?: string;
    to?: string;
    driverId?: string;
    type?: string;
    status?: string;
    perPage?: number;
  }): Promise<WalletTransaction[]> {
    const qs = new URLSearchParams();
    if (params?.from)     qs.set('from',      params.from);
    if (params?.to)       qs.set('to',        params.to);
    if (params?.driverId) qs.set('driver_id', params.driverId);
    if (params?.type && params.type !== 'all')   qs.set('type',   params.type);
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    qs.set('per_page', String(params?.perPage ?? 100));

    const raw = await apiClient.get<unknown>(
      `/fleet-admin/wallet/transactions?${qs.toString()}`,
    );
    return extractList<ApiTransaction>(raw).map(mapTransaction);
  },

  async getBalance(driverId: string): Promise<number> {
    const res = await apiClient.get<{
      data?: { balance?: number; balance_sar?: number };
      balance_sar?: number;
      balance?: number;
    }>(`/fleet-admin/wallet/balance/${driverId}`);
    // Backend wraps response: { success, data: { driver_id, name, balance, currency } }
    const inner = (res.data && typeof res.data === 'object') ? res.data : res;
    return inner.balance_sar ?? inner.balance ?? 0;
  },

  /**
   * Step 1 — Call BEFORE showing the Moyasar form.
   * Backend provisions the pending wallet transaction and returns everything
   * Moyasar.init() needs, including the metadata object that links the payment
   * back to the wallet transaction.  Do NOT build your own metadata.
   */
  async initiateTopUp(params: {
    driverId: string;
    amount:   number;
  }): Promise<{
    walletTransactionUuid: string;
    paymentData: {
      amount:         number;              // already in halalas
      currency:       string;
      description:    string;
      publishableKey: string;
      callbackUrl:    string;
      metadata:       Record<string, string>;
    };
  }> {
    const res = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: {
        wallet_transaction_uuid?: string;
        payment_data?: {
          amount?:          number;
          currency?:        string;
          description?:     string;
          publishable_key?: string;
          callback_url?:    string | null;
          metadata?:        Record<string, string>;
        };
      };
    }>('/fleet-admin/wallet/top-up/initiate', {
      driver_id: Number(params.driverId),
      amount:    params.amount,
    });

    if (res.success === false) throw new Error(res.message ?? 'Top-up initiation failed');

    const d  = res.data ?? {};
    const pd = d.payment_data ?? {};

    return {
      walletTransactionUuid: d.wallet_transaction_uuid ?? '',
      paymentData: {
        amount:         pd.amount         ?? 0,
        currency:       pd.currency       ?? 'SAR',
        description:    pd.description    ?? 'Driver wallet top-up',
        publishableKey: pd.publishable_key ?? '',
        callbackUrl:    pd.callback_url   ?? '',
        metadata:       (pd.metadata as Record<string, string>) ?? {},
      },
    };
  },

  /** Step 2 — Verify payment after Moyasar 3DS redirect. */
  async verifyTopUp(paymentId: string): Promise<{
    status:   string;
    amount?:  number;
    balance?: number;
  }> {
    const res = await apiClient.post<{
      success?: boolean;
      data?: { status?: string; amount?: number; balance?: number };
    }>('/fleet-admin/wallet/top-up/verify', { payment_id: paymentId });

    return {
      status:  res.data?.status  ?? 'failed',
      amount:  res.data?.amount,
      balance: res.data?.balance,
    };
  },

  async topUp(
    driverId: string,
    amount: number,
    _paymentMethod: string,
    note?: string,
  ): Promise<Driver> {
    const res = await apiClient.post<{
      data?: { driver_id?: number | string; balance?: number; balance_sar?: number };
    }>('/fleet-admin/wallet/top-up', { driver_id: Number(driverId), amount, note });
    // Response: { success, data: { driver_id, name, amount, balance, currency, note } }
    // No full driver object — extract the new balance and return a stub for merging
    const data = (res.data && typeof res.data === 'object') ? res.data : {};
    const newBalance = data.balance ?? data.balance_sar ?? amount;
    return {
      id:           String(data.driver_id ?? driverId),
      name:         '',
      phone:        '',
      vehicleModel: '',
      status:       'active',
      trips:        0,
      totalCost:    0,
      charges:      0,
      swaps:        0,
      walletBalance: newBalance,
      documents: {
        license:     { status: 'not_uploaded', hasLicense: false },
        customsCard: { status: 'not_uploaded' },
        plate:       { status: 'not_uploaded' },
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Notifications API
// ─────────────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  async list(perPage = 50): Promise<Notification[]> {
    const raw = await apiClient.get<unknown>(
      `/fleet-admin/notifications?status=all&per_page=${perPage}`,
    );
    return extractList<ApiNotification>(raw).map(mapNotification);
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<{
      unread_count?: number;
      count?: number;
      data?: { unread_count?: number; count?: number };
    }>('/fleet-admin/notifications/unread-count');
    const inner = res.data && typeof res.data === 'object' ? res.data : res;
    return inner.unread_count ?? inner.count ?? 0;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/fleet-admin/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/fleet-admin/notifications/read-all');
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/fleet-admin/notifications/${id}`);
  },

  async clearAll(): Promise<void> {
    await apiClient.delete('/fleet-admin/notifications');
  },
};
