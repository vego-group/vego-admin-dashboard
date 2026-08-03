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

import { ApiError, apiClient } from '@/lib/api/client';
import { isFieldLevelError } from '@/lib/api-errors';
import {
  SEEDED_COUNTRIES,
  matchesPhoneRegex,
  phoneLengthFromRegex,
  seededCountries,
  seededCurrencyFor,
  toDialCode,
  toIsoCountryCode,
} from '@/lib/country';
import { logger } from '@/lib/logger';
import {
  decimalsForCurrency,
  fractionDigitsOf,
  fromMinorUnits,
  moneyToNumber,
  parseAmount,
  readMoney,
  type ApiMoneyFields,
} from '@/lib/money';
import type {
  BatteryDistribution,
  BatteryHealthPoint,
  Alarm,
  MinTopUpReason,
  Money,
  ServicePrice,
  TopUpOptions,
  AlarmSeverity,
  AlarmStatus,
  BatteryStation,
  CancelledSessions,
  CostBreakdown,
  Country,
  DashboardMetrics,
  DeviceStatus,
  DialCode,
  Driver,
  DriverDocuments,
  DriverSession,
  DriverStatusChangeResult,
  FleetProfile,
  IoTDevice,
  SessionKind,
  SessionStatus,
  DriverRegistrationRequest,
  FastChargingCabinet,
  FastChargingStatus,
  Notification,
  NotificationType,
  RevenuePoint,
  SavedCard,
  SwappingStation,
  TransactionDirection,
  TransactionType,
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
  /** Not returned by the fleet-admin list today — mapped when it appears. */
  created_at?: string | null;
  /** Dial prefix, e.g. "+966" — despite the name this is NOT a country. */
  country_code?: string | null;
  /** ISO 3166-1 alpha-2, e.g. "SA" | "JO" — this is the country. */
  iso_country_code?: string | null;
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
  // Document status on list rows (added with the upload feature)
  driving_license_status?: string | null;
  plate_status?: string | null;
  // Motorcycle — list returns assigned_motorcycle, show returns motorcycle
  assigned_motorcycle?: { id?: number; model_name?: string; model?: string; plate_number?: string } | null;
  motorcycle?: { id?: number; model_name?: string; model?: string; plate_number?: string } | null;
  // Stats — not present in list/show response yet; will be 0 until backend adds them
  trips_count?: number;
  total_cost?: number;
  charges_count?: number;
  swaps_count?: number;
  // Wallet balance — the show endpoint returns the money object; the list
  // response still carries a flat scalar in the fleet's own currency.
  wallet_balance?: string | number;
  wallet?: ApiMoneyFields;
  // Document objects — real API (show endpoint) returns these with the upload feature.
  driving_license?: {
    status?: string;
    // real: number; legacy: license_number
    number?: string;
    license_number?: string;
    expiry_date?: string;
    has_license?: boolean;
    file_url?: string;
    back_file_url?: string;
    rejection_reason?: string | null;
  };
  plate?: { status?: string; number?: string; plate_number?: string; file_url?: string; rejection_reason?: string | null };
  customs_card?: { status?: string };
}

interface ApiMotorcycle {
  id: number | string;
  plate_number?: string;
  // Real API returns brand + model separately ("VEGO" + "Pro 400")
  brand?: string;
  model_name?: string;
  model?: string;
  status?: string;
  city?: string;
  // Real API: battery_percentage is the SOC; keep soc_pct as legacy fallback
  battery?: { battery_percentage?: number; soc_pct?: number; soh?: number; soh_pct?: number; status?: string };
  // Motorcycle-level telemetry snapshot (strings)
  current_lat?: string | number;
  current_lng?: string | number;
  iot_device?: {
    id?: number | string;
    is_online?: boolean;
    last_seen_at?: string;
    // Legacy flat telemetry
    latitude?: number;
    longitude?: number;
    speed_kmh?: number;
    gps_signal?: string;
    // Real API nests the latest telemetry
    latest_gps?: { latitude?: number | string; longitude?: number | string; speed?: number; gps_signal?: string };
    latest_battery?: { soc?: number; relative_soc?: number; soh?: number; voltage?: number };
  };
  // Real API: assigned_user; legacy: driver
  assigned_user?: { id: number | string; name: string } | null;
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
  /**
   * Confirmed direction of the movement — "in" (credit, refund) or "out"
   * (debit). Added alongside `signed_amount`; absent on older payloads.
   */
  direction?: string | null;
  /**
   * Money object: amount is a fixed-precision string ("100.000") accompanied by
   * currency / minor_units / decimals.
   *
   * **`amount` is always the magnitude.** A debit arrives positive with
   * `type: "debit"`; the backend normalises a negative to its magnitude on write.
   */
  amount?: number | string;
  /** The same value with the sign applied, e.g. "-3.250". Exact decimal string. */
  signed_amount?: number | string | null;
  currency?: string | null;
  minor_units?: number | null;
  decimals?: number | null;
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

/** Raw block / toggle-status response payload. `cancelled_sessions` is optional. */
interface StatusChangeResponse {
  data?: {
    id: number | string;
    status: string;
    cancelled_sessions?: {
      swap_sessions?: number[];
      charging_sessions?: number[];
    };
  };
}

/**
 * Coerce the raw `cancelled_sessions` field into a well-formed shape, or undefined
 * when absent. Tolerates missing arrays so callers never crash on partial payloads.
 */
function normalizeCancelledSessions(
  raw?: { swap_sessions?: number[]; charging_sessions?: number[] },
): CancelledSessions | undefined {
  if (!raw) return undefined;
  return {
    swap_sessions: raw.swap_sessions ?? [],
    charging_sessions: raw.charging_sessions ?? [],
  };
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
  // Real API returns flat fields; the show endpoint returns nested document objects.
  const license = d.driving_license;
  const plate   = d.plate;
  const customs = d.customs_card;

  const hasLicense   = d.has_license ?? license?.has_license ?? !!license;
  const licenseNum   = license?.number ?? license?.license_number ?? d.driving_license_number ?? undefined;
  const licenseFile  = d.driving_license_file;
  // Prefer the explicit status (nested object or flat list field); else infer.
  const licenseStatus =
    license?.status ?? d.driving_license_status
      ? toDocStatus(license?.status ?? d.driving_license_status ?? undefined)
      : licenseNum || licenseFile
        ? 'verified'
        : hasLicense
          ? 'pending'
          : 'not_uploaded';

  const documents: DriverDocuments = {
    license: {
      status:          licenseStatus,
      hasLicense,
      number:          licenseNum,
      expiryDate:      license?.expiry_date,
      fileUrl:         license?.file_url,
      backFileUrl:     license?.back_file_url,
      rejectionReason: license?.rejection_reason ?? undefined,
    },
    customsCard: { status: toDocStatus(customs?.status) },
    plate: {
      status:          toDocStatus(plate?.status ?? d.plate_status ?? undefined),
      number:          plate?.number ?? plate?.plate_number,
      fileUrl:         plate?.file_url,
      rejectionReason: plate?.rejection_reason ?? undefined,
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
    assignedMotorcycleId:    moto?.id != null ? String(moto.id) : undefined,
    assignedMotorcyclePlate: moto?.plate_number ?? undefined,
    status:       toDriverStatus(d.status),
    trips:        d.trips_count ?? 0,
    totalCost:    d.total_cost ?? 0,
    charges:      d.charges_count ?? 0,
    swaps:        d.swaps_count ?? 0,
    walletBalance: moneyToNumber(readMoney(d.wallet, { amount: d.wallet_balance })),
    dialCode:       toDialCode(d.country_code),
    isoCountryCode: toIsoCountryCode(d.iso_country_code),
    createdAt:     d.created_at ?? undefined,
    documents,
  };
}

function mapMotorcycle(m: ApiMotorcycle): Vehicle {
  const iot = m.iot_device;
  const gps = iot?.latest_gps;
  // Real API returns brand + model separately ("VEGO" + "Pro 400"); combine them.
  const model = [m.brand, m.model_name ?? m.model].filter(Boolean).join(' ').trim() || 'VegoMax Pro';
  // Real API driver is `assigned_user`; older shape used `driver`.
  const driver = m.assigned_user ?? m.driver ?? undefined;

  // Position, or nothing. This used to fall back to 24.7136 / 46.6753 — central
  // Riyadh — which silently relocated every vehicle that had never reported GPS.
  // For a Jordanian fleet that put the whole offline half of the fleet in another
  // country. A missing position is now missing: the maps drop the marker and the
  // lists say so. Latitude 0 / longitude 0 are legal values, so the guard tests
  // for `undefined`, not falsiness.
  const lat = num(gps?.latitude)  ?? num(m.current_lat) ?? num(iot?.latitude);
  const lng = num(gps?.longitude) ?? num(m.current_lng) ?? num(iot?.longitude);
  const coordinates = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;

  return {
    id:                 String(m.id),
    plateNumber:        m.plate_number ?? `VH-${m.id}`,
    model:              model as Vehicle['model'],
    status:             toVehicleStatus(m.status),
    // Real API: battery.battery_percentage is the SOC.
    batteryLevel:       m.battery?.battery_percentage ?? m.battery?.soc_pct ?? 0,
    location:           m.city ?? '',
    coordinates,
    assignedDriverId:   driver ? String(driver.id) : undefined,
    assignedDriverName: driver?.name,
    lastTripAt:         m.last_trip_at ?? new Date().toISOString(),
    totalDistanceKm:    m.total_distance_km ?? 0,
    currentSpeedKmh:    gps?.speed ?? iot?.speed_kmh ?? 0,
    estimatedRangeKm:   m.estimated_range_km ?? 0,
    speedLimitKmh:      m.speed_limit_kmh ?? 80,
    isLocked:           m.is_locked ?? false,
    isEngineRunning:    m.is_engine_running ?? false,
    gpsSignal:          (gps?.gps_signal ?? iot?.gps_signal ?? 'strong') as Vehicle['gpsSignal'],
    isOnline:           iot?.is_online ?? false,
  };
}

/**
 * The position a site record carries, or **undefined**.
 *
 * Cabinets and piles used to fall back to 24.7136 / 46.6753 — central Riyadh —
 * exactly as vehicles did, in three separate copies of the same expression. A
 * site with no coordinate is unlocated; it is dropped from maps and labelled in
 * lists. Both fields must resolve: a lone latitude is not a position.
 *
 * The backend sends these as strings ("24.71360000"), hence `num()`.
 */
function readSiteCoordinates(
  s: { lat?: string | number; lng?: string | number; latitude?: number; longitude?: number },
): { lat: number; lng: number } | undefined {
  const lat = num(s.lat) ?? num(s.latitude);
  const lng = num(s.lng) ?? num(s.longitude);
  return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
}

function mapCabinet(c: ApiCabinet): SwappingStation {
  return {
    id:                 String(c.id),
    cabinetId:          c.cabinet_id ?? `#CF-${String(c.id).padStart(4, '0')}`,
    name:               c.name ?? `Cabinet ${c.id}`,
    district:           c.district ?? c.address ?? c.location ?? '',
    // No 'Riyadh' default. Stamping a city name onto a record is worse than
    // stamping a coordinate: the wrong *name* reads as fact in a list, an export
    // and a search, and nothing about it looks like a placeholder.
    city:               c.city ?? '',
    coordinates:        readSiteCoordinates(c),
    readyBatteries:     c.ready_batteries     ?? c.ready_batteries_count     ?? 0,
    chargingBatteries:  c.charging_batteries  ?? c.charging_batteries_count  ?? 0,
    emptySlots:         c.empty_slots         ?? c.empty_slots_count         ?? 0,
    totalCapacity:      c.total_capacity      ?? c.total_slots               ?? 0,
    avgWaitTimeMinutes: c.avg_wait_time_minutes ?? c.avg_wait_minutes        ?? 0,
    todaySwaps:         c.today_swaps         ?? c.today_swaps_count         ?? 0,
  };
}

/**
 * `BatteryStation` — the shape the live map speaks — as a projection of the
 * swapping station.
 *
 * `stationsApi.list` used to re-map `ApiCabinet` by hand, which is how a third
 * copy of the Riyadh fallback survived the first two being noticed. It is a
 * strict subset: every field here is either a rename of a `SwappingStation`
 * field or a constant, so there is nothing left to drift.
 */
function toBatteryStation(s: SwappingStation): BatteryStation {
  return {
    id:                 s.id,
    name:               s.name,
    district:           s.district,
    city:               s.city,
    coordinates:        s.coordinates,
    available:          s.readyBatteries,
    charging:           s.chargingBatteries,
    // The cabinet endpoint reports no in-use count; ready + charging is the whole
    // picture it gives us.
    inUse:              0,
    totalCapacity:      s.totalCapacity,
    avgWaitTimeMinutes: s.avgWaitTimeMinutes,
    todaySwaps:         s.todaySwaps,
    type:               'swap',
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

  return {
    id:                   String(p.id),
    cabinetId:            p.pile_id ?? p.dev_id ?? `FC-${String(p.id).padStart(5, '0')}`,
    name:                 p.name ?? `Pile ${p.id}`,
    district:             p.district ?? p.address ?? p.location ?? '',
    city:                 p.city ?? '',
    coordinates:          readSiteCoordinates(p),
    availablePorts:       available,
    chargingPorts:        charging,
    errorPorts:           error,
    totalPorts,
    avgChargeTimeMinutes: p.avg_charge_time_minutes ?? 0,
    todaySessions:        p.today_sessions ?? p.today_sessions_count ?? 0,
    status:               toFcStatus(p.status ?? p.live_status),
  };
}

/** Transaction `type` values that move money **out** of the wallet. */
const DEBIT_TYPES = new Set([
  'debit', 'fast_charging', 'fast_charge', 'charging', 'swap', 'battery_swap',
]);

/**
 * Which way the money moved.
 *
 * The backend's `direction` is authoritative when present. Otherwise the *type*
 * decides — never the sign of the amount. Confirmed convention (§8 of
 * dashboard-country-currency-answers-updated.md): a debit arrives as a
 * **positive** amount with `type: "debit"`, and a negative passed in is
 * normalised to its magnitude on write. Reading the sign was exactly why debits
 * rendered green as credits.
 */
function toDirection(tx: ApiTransaction): TransactionDirection {
  const raw = (tx.direction ?? '').toLowerCase();
  if (raw === 'in' || raw === 'out') return raw;
  return DEBIT_TYPES.has(tx.type ?? '') ? 'out' : 'in';
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

  // Fixed-precision money object — resolved through integer minor units.
  // `amount` is the magnitude by contract, but a legacy row that still carries a
  // negative must not become a negative magnitude, so take the absolute value.
  const raw   = readMoney(tx);
  const money = raw.minorUnits < 0
    ? { ...raw, minorUnits: -raw.minorUnits, amount: fromMinorUnits(-raw.minorUnits, raw.decimals) }
    : raw;

  const direction = toDirection(tx);
  // Prefer the backend's own signed string; otherwise apply the sign ourselves so
  // the field is always present and always consistent with `direction`.
  const signedAmount = tx.signed_amount != null && tx.signed_amount !== ''
    ? String(tx.signed_amount)
    : (direction === 'out' && money.minorUnits !== 0 ? `-${money.amount}` : money.amount);

  return {
    id:            String(tx.id),
    createdAt:     tx.created_at ?? new Date().toISOString(),
    driverId:      String(driver?.id ?? ''),
    driverName:    driver?.name ?? '',
    amount:        moneyToNumber(money),
    money,
    direction,
    signedAmount,
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
// Countries — GET /countries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One country as the roster endpoint returns it.
 *
 * Field names are given generously because this payload is consumed by three
 * clients and has already been renamed once: `phone_example` used to hold the
 * mask that is now `phone_placeholder`, and an environment that has not picked
 * up the reseed still sends the old meaning.
 */
interface ApiCountry {
  code?: string | null;
  iso_code?: string | null;
  iso_country_code?: string | null;
  name?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
  /** Dial prefix, e.g. "+962". On this payload `country_code` is an alias for it. */
  dial_code?: string | null;
  country_code?: string | null;
  currency?: string | null;
  currency_code?: string | null;
  currency_decimals?: number | null;
  decimals?: number | null;
  phone_regex?: string | null;
  phone_placeholder?: string | null;
  /** Real E.164 number since the reseed; a format mask on older environments. */
  phone_example?: string | null;
  phone_example_national?: string | null;
  national_number_length?: number | null;
  is_active?: boolean | null;
}

/** Does this look like a format mask ("5X XXX XXXX") rather than a number? */
function looksLikeMask(value: string): boolean {
  return /[Xx#]/.test(value);
}

function mapCountry(c: ApiCountry): Country | null {
  const isoCountryCode = toIsoCountryCode(c.code ?? c.iso_code ?? c.iso_country_code);
  if (!isoCountryCode) return null;

  // The seed is the backstop for any fact this environment omits — never a
  // hardcoded assumption at the point of use.
  const seed = SEEDED_COUNTRIES[isoCountryCode];

  const dialCode = toDialCode(c.dial_code ?? c.country_code) ?? seed?.dialCode;
  if (!dialCode) return null;

  const rawExample = c.phone_example ?? '';
  const currency   = c.currency ?? c.currency_code ?? seed?.currency ?? undefined;
  const phoneRegex = c.phone_regex ?? seed?.phoneRegex ?? '';

  // This environment derives both `national_number_length` and
  // `phone_example_national` by stripping the non-digits out of the display mask,
  // so "5X XXX XXXX" arrives as a length of 1 and an example of "5". A length of 1
  // caps the login field at a single character, so neither field is taken on
  // trust: the length is read off `phone_regex` — the rule the number is actually
  // validated against — and the example is kept only if it satisfies that rule.
  const rawExampleNational = c.phone_example_national ?? '';

  return {
    isoCountryCode,
    dialCode,
    nameEn: c.name_en ?? c.name ?? seed?.nameEn ?? isoCountryCode,
    nameAr: c.name_ar ?? seed?.nameAr ?? c.name_en ?? isoCountryCode,
    currency,
    currencyDecimals:
      c.currency_decimals ?? c.decimals ?? seed?.currencyDecimals ?? decimalsForCurrency(currency),
    phoneRegex,
    // `phone_placeholder` is the mask; fall back to `phone_example` only while it
    // still holds one, never once it holds a real number.
    phonePlaceholder:
      c.phone_placeholder ??
      (rawExample && looksLikeMask(rawExample) ? rawExample : undefined) ??
      seed?.phonePlaceholder ??
      '',
    phoneExampleNational: matchesPhoneRegex(rawExampleNational, phoneRegex)
      ? rawExampleNational
      : seed?.phoneExampleNational ?? '',
    nationalNumberLength:
      phoneLengthFromRegex(phoneRegex) ??
      c.national_number_length ??
      seed?.nationalNumberLength ??
      15,
  };
}

export const countriesApi = {
  /**
   * The country roster: `GET /countries`, at the **API root** and with no token —
   * it has to render on the login screen, before there is a session.
   *
   * Never throws. An unreachable backend and a successful-but-empty response are
   * the same outcome for the caller — no roster — and both fall back to the
   * offline seed. The shared environment currently returns zero countries, which
   * is why the empty case is a warning and not an error: a login screen with no
   * country to pick would be worse than one seeded with the two live markets.
   */
  async list(): Promise<Country[]> {
    let mapped: Country[] = [];

    try {
      const raw = await apiClient.get<unknown>('/countries');
      mapped = extractList<ApiCountry>(raw)
        .filter((c) => c.is_active !== false)
        .map(mapCountry)
        .filter((c): c is Country => c !== null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[countriesApi] GET /countries failed (${message}) — falling back to the ` +
        'seeded SA/JO roster.',
      );
      return seededCountries();
    }

    if (mapped.length === 0) {
      logger.warn(
        '[countriesApi] GET /countries returned no usable countries — falling back ' +
        'to the seeded SA/JO roster.',
      );
      return seededCountries();
    }

    return mapped;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fleet self-profile — GET /fleet-admin/me
// ─────────────────────────────────────────────────────────────────────────────

interface ApiFleetMe {
  fleet?: {
    id?: number | string;
    name?: string;
    iso_country_code?: string | null;
    /** Dial prefix — present for display, never used to resolve the country. */
    country_code?: string | null;
    currency?: string | null;
    currency_decimals?: number | null;
    money_format?: string | null;
    max_drivers?: number | null;
    status?: string | null;
  };
  user?: {
    id?: number | string;
    name?: string;
    email?: string | null;
  };
}

export const fleetAdminApi = {
  /**
   * The fleet's own profile: which country it belongs to and which currency its
   * money is denominated in.
   *
   * This is the single source of truth for both. A fleet's country lives on its
   * fleet record and is not client-selectable — the Fleet Admin realm rejects a
   * `?country=` parameter with a 422, so never send one.
   */
  async getMe(): Promise<FleetProfile> {
    const raw = await apiClient.get<{ data?: ApiFleetMe } & ApiFleetMe>('/fleet-admin/me');
    const body = (raw.data && typeof raw.data === 'object') ? raw.data : raw;
    const fleet = body.fleet ?? {};

    const isoCountryCode = toIsoCountryCode(fleet.iso_country_code) ?? null;
    // Prefer the fleet's declared currency; fall back to the country seed only
    // when the payload omits it entirely.
    const seeded   = seededCurrencyFor(isoCountryCode);
    const currency = fleet.currency ?? seeded?.currency;
    const decimals = fleet.currency_decimals
      ?? seeded?.currencyDecimals
      ?? decimalsForCurrency(currency);

    // A profile without a currency is not a profile we can format money against.
    // Fail loudly rather than substituting a default — callers treat the throw as
    // "unresolved" and render amounts unlabelled, which is the honest outcome.
    if (!currency || decimals == null) {
      throw new Error(
        'GET /fleet-admin/me returned no currency for this fleet ' +
        `(currency=${String(fleet.currency)}, iso_country_code=${String(fleet.iso_country_code)}).`,
      );
    }

    return {
      id:               String(fleet.id ?? ''),
      name:             fleet.name ?? '',
      isoCountryCode,
      currency,
      currencyDecimals: decimals,
      maxDrivers:       fleet.max_drivers ?? undefined,
      status:           fleet.status ?? undefined,
    };
  },
};

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

// Vehicle control commands (POST /fleet-admin/motorcycles/{id}/command)
export type VehicleCommand = 'lock' | 'unlock' | 'start' | 'stop' | 'emergency_stop' | 'set_speed_limit';

export interface VehicleControlState {
  isLocked: boolean;
  isEngineRunning: boolean;
  speedLimitKmh: number;
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

  /**
   * Send a control command to a motorcycle.
   * Endpoint: POST /fleet-admin/motorcycles/{id}/command
   * Returns the authoritative control state the backend persisted, or null on error.
   */
  async sendCommand(
    motorcycleId: string,
    action: VehicleCommand,
    speedLimit?: number,
  ): Promise<VehicleControlState | null> {
    try {
      const res = await apiClient.post<{
        data?: { is_locked?: boolean; is_engine_running?: boolean; speed_limit_kmh?: number };
      }>(`/fleet-admin/motorcycles/${motorcycleId}/command`, {
        action,
        ...(action === 'set_speed_limit' && speedLimit != null ? { speed_limit: speedLimit } : {}),
      });
      const d = res.data ?? {};
      return {
        isLocked:        d.is_locked ?? false,
        isEngineRunning: d.is_engine_running ?? false,
        speedLimitKmh:   d.speed_limit_kmh ?? speedLimit ?? 0,
      };
    } catch {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stations API (legacy BatteryStation used by the live map)
// ─────────────────────────────────────────────────────────────────────────────

export const stationsApi = {
  async list(): Promise<BatteryStation[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/cabinets');
    // One cabinet mapper, then a projection — see toBatteryStation.
    return extractList<ApiCabinet>(raw).map(mapCabinet).map(toBatteryStation);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Drivers API
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverCreateInput {
  name: string;
  /** Full E.164, e.g. '+962791234567'. Build it with `toE164()`. */
  phone: string;
  /**
   * Dial prefix for `phone`, sent as the API's `country_code`.
   *
   * On a **user** `country_code` is the dial prefix, not an ISO code — the ISO
   * code lives in `iso_country_code`. A fleet's drivers are always in the fleet's
   * country, so this is the fleet's dial code, never a per-driver choice.
   */
  dialCode?: DialCode;
  email?: string;
  address?: string;
  city?: string;
  documents?: DriverDocuments;
}

/**
 * Deliberately absent from both inputs:
 *
 * - **`status`** — `POST`/`PUT /fleet-admin/drivers` do not accept it. Status is
 *   owned by `/toggle-status`, `/block` and `/unblock`, which also return the
 *   sessions they cancelled. A `status` on this body was collected by the form
 *   and dropped on the floor.
 * - **`vehicleModel`** — a motorcycle is assigned with
 *   `POST /fleet-admin/motorcycles/{id}/assign-driver`, by id. A model *name* is
 *   not an assignment and was never sent.
 */
export type DriverUpdateInput = Partial<DriverCreateInput>;

/** Files + fields for POST /fleet-admin/drivers/{id}/documents (any subset). */
export interface DriverDocumentUploadInput {
  licenseFront?: File | null;
  licenseBack?: File | null;
  licenseNumber?: string;
  licenseExpiry?: string;
  plateImage?: File | null;
  plateNumber?: string;
}

export const driversApi = {
  async list(): Promise<Driver[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/drivers');
    return extractList<ApiDriver>(raw).map(mapDriver);
  },

  /** Full driver detail — includes document file_url / rejection_reason the list omits. */
  async get(id: string): Promise<Driver | null> {
    try {
      const res = await apiClient.get<{ data?: ApiDriver } | ApiDriver>(`/fleet-admin/drivers/${id}`);
      const raw = (res as { data?: ApiDriver }).data ?? (res as ApiDriver);
      return mapDriver(raw);
    } catch {
      return null;
    }
  },

  async create(input: DriverCreateInput): Promise<Driver> {
    // POST /fleet-admin/drivers — only send fields the backend accepts
    const body: Record<string, string | undefined> = {
      name:  input.name,
      phone: input.phone,
    };
    if (input.dialCode)                          body['country_code']           = input.dialCode;
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
      // PUT /fleet-admin/drivers/:id — send every field the caller supplied.
      //
      // The guards are `!== undefined`, not truthiness. Truthiness meant `''` was
      // indistinguishable from "not supplied", so an operator could never clear
      // an email, address or city: the field was dropped and the old value
      // survived, with the form showing the clear as if it had saved. `undefined`
      // is "leave alone"; `''` is "clear this", and it is sent as `''`.
      //
      // ⚠️ Whether the backend clears a column on `""` or requires `null` is
      // unconfirmed — see the note in the change report. If it needs `null`,
      // this is the one line to change.
      const body: Record<string, string | undefined> = {};
      if (updates.name     !== undefined) body['name']         = updates.name;
      if (updates.phone    !== undefined) body['phone']        = updates.phone;
      if (updates.dialCode !== undefined) body['country_code'] = updates.dialCode;
      if (updates.email    !== undefined) body['email']        = updates.email;
      if (updates.address  !== undefined) body['address']      = updates.address;
      if (updates.city     !== undefined) body['city']         = updates.city;

      // Licence expiry and plate number were accepted by `create` and silently
      // dropped by `update`. Editing either one alone was a no-op unless the
      // operator also happened to attach a file, because only the multipart
      // documents endpoint carried them.
      const license = updates.documents?.license;
      const plate   = updates.documents?.plate;
      if (license?.number     !== undefined) body['driving_license_number'] = license.number;
      if (license?.expiryDate !== undefined) body['driving_license_expiry'] = license.expiryDate;
      if (plate?.number       !== undefined) body['plate_number']           = plate.number;

      const res = await apiClient.put<{ data: ApiDriver } | ApiDriver>(`/fleet-admin/drivers/${id}`, body);
      const raw = (res as { data?: ApiDriver }).data ?? (res as ApiDriver);
      return mapDriver(raw);
    } catch (err) {
      // A rejected country or phone is the operator's to fix, and the form can
      // only show it next to the field if it survives this catch. Everything else
      // keeps the historical null-on-failure contract.
      if (isFieldLevelError(err)) throw err;
      return null;
    }
  },

  /**
   * Upload a driver's licence / plate documents (multipart).
   * Endpoint: POST /fleet-admin/drivers/{id}/documents
   * Returns the updated license + plate document state, or null on error / nothing to send.
   */
  async uploadDocuments(
    id: string,
    input: DriverDocumentUploadInput,
  ): Promise<Pick<DriverDocuments, 'license' | 'plate'> | null> {
    const fd = new FormData();
    if (input.licenseFront)  fd.append('driving_license_front', input.licenseFront);
    if (input.licenseBack)   fd.append('driving_license_back', input.licenseBack);
    if (input.licenseNumber) fd.append('driving_license_number', input.licenseNumber);
    if (input.licenseExpiry) fd.append('driving_license_expiry', input.licenseExpiry);
    if (input.plateImage)    fd.append('plate_image', input.plateImage);
    if (input.plateNumber)   fd.append('plate_number', input.plateNumber);

    let hasAny = false;
    fd.forEach(() => { hasAny = true; });
    if (!hasAny) return null;

    try {
      const res = await apiClient.postForm<{
        data?: {
          driving_license?: { status?: string; number?: string; expiry_date?: string; file_url?: string; back_file_url?: string; rejection_reason?: string | null };
          plate?: { status?: string; number?: string; file_url?: string; rejection_reason?: string | null };
        };
      }>(`/fleet-admin/drivers/${id}/documents`, fd);

      const lic = res.data?.driving_license;
      const pl  = res.data?.plate;
      const licStatus = toDocStatus(lic?.status);
      return {
        license: {
          status:          licStatus,
          hasLicense:      licStatus !== 'not_uploaded',
          number:          lic?.number,
          expiryDate:      lic?.expiry_date,
          fileUrl:         lic?.file_url,
          backFileUrl:     lic?.back_file_url,
          rejectionReason: lic?.rejection_reason ?? undefined,
        },
        plate: {
          status:          toDocStatus(pl?.status),
          number:          pl?.number,
          fileUrl:         pl?.file_url,
          rejectionReason: pl?.rejection_reason ?? undefined,
        },
      };
    } catch {
      return null;
    }
  },

  /**
   * Toggle active ↔ inactive. Returns the new status plus any sessions the
   * backend cancelled (present only when the result is `inactive`), or null on error.
   */
  async toggleStatus(id: string): Promise<DriverStatusChangeResult | null> {
    try {
      const res = await apiClient.patch<StatusChangeResponse>(
        `/fleet-admin/drivers/${id}/toggle-status`,
      );
      if (!res.data?.status) return null;
      return {
        status: toDriverStatus(res.data.status),
        cancelled_sessions: normalizeCancelledSessions(res.data.cancelled_sessions),
      };
    } catch {
      return null;
    }
  },

  /**
   * Block a driver. Returns the new status ('blocked') plus any sessions the
   * backend cancelled, or null on error.
   */
  async block(id: string): Promise<DriverStatusChangeResult | null> {
    try {
      const res = await apiClient.patch<StatusChangeResponse>(
        `/fleet-admin/drivers/${id}/block`,
      );
      if (!res.data?.status) return null;
      return {
        status: toDriverStatus(res.data.status),
        cancelled_sessions: normalizeCancelledSessions(res.data.cancelled_sessions),
      };
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
// Zones API  (/fleet-admin/zones)
// ─────────────────────────────────────────────────────────────────────────────

interface ApiZone {
  id: number | string;
  name_en: string;
  name_ar: string;
  type: string;
  speed_limit: number | null;
  coordinates: string; // WKT POLYGON
  is_active: boolean;
  created_at?: string;
}

interface ApiZoneListResponse {
  success: boolean;
  data: ApiZone[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

interface ApiZoneSingleResponse {
  success: boolean;
  data: ApiZone;
}

function wktToPoints(wkt: string): ZonePoint[] {
  const match = wkt.match(/POLYGON\s*\(\((.+)\)\)/i);
  if (!match) return [];
  const pairs = match[1].split(',').map((s) => s.trim().split(/\s+/));
  // WKT uses (lng lat) order; drop the closing duplicate point
  return pairs
    .slice(0, -1)
    .map(([lngStr, latStr]) => ({ lat: parseFloat(latStr), lng: parseFloat(lngStr) }));
}

function pointsToWkt(points: ZonePoint[]): string {
  if (points.length === 0) return '';
  const closed = [...points, points[0]];
  return `POLYGON((${closed.map((p) => `${p.lng} ${p.lat}`).join(', ')}))`;
}

/**
 * Every zone type the app can render. `ZONE_TYPES` in @/lib/zone-types is keyed
 * by exactly these, and the zone cards index it unguarded — anything outside the
 * union reaches `cfg.labelKey` as `undefined.labelKey` and throws.
 */
const ZONE_TYPE_VALUES: readonly ZoneType[] = ['normal', 'slow', 'restricted'];

/**
 * Names the backend has used for a zone type that are not the union's own.
 * `operational` was the old default written here — it is the permissive zone,
 * i.e. `normal`.
 */
const ZONE_TYPE_ALIASES: Record<string, ZoneType> = {
  operational: 'normal',
  standard:    'normal',
  low_speed:   'slow',
  slow_zone:   'slow',
  no_ride:     'restricted',
  noride:      'restricted',
  forbidden:   'restricted',
  prohibited:  'restricted',
};

/**
 * Total over the real {@link ZoneType} union — there is no input that can make
 * this return something the zone cards cannot render.
 *
 * An unrecognised type falls back to `normal` rather than `restricted`: a zone
 * we cannot classify must not be presented as a no-riding zone the fleet's
 * drivers are barred from, and the warning below is how the mismatch surfaces.
 */
function toZoneType(raw: unknown): ZoneType {
  const key = String(raw ?? '').trim().toLowerCase();
  if ((ZONE_TYPE_VALUES as readonly string[]).includes(key)) return key as ZoneType;
  const alias = ZONE_TYPE_ALIASES[key];
  if (alias) return alias;
  if (key) logger.warn(`[Zones] Unknown zone type "${key}" — rendering as "normal".`);
  return 'normal';
}

function mapApiZone(api: ApiZone): Zone {
  const nameEn = api.name_en ?? '';
  return {
    id:           String(api.id),
    name:         nameEn || api.name_ar || 'Unnamed',
    name_en:      nameEn,
    name_ar:      api.name_ar ?? '',
    type:         toZoneType(api.type),
    speedLimitKmh: api.speed_limit ?? 0,
    active:       api.is_active,
    visible:      true,
    polygon:      wktToPoints(api.coordinates ?? ''),
    createdAt:    api.created_at ?? new Date().toISOString(),
  };
}

export interface ZoneCreateInput {
  name_en: string;
  name_ar: string;
  type: ZoneType;
  speedLimitKmh: number;
  active: boolean;
  polygon: ZonePoint[];
}

export type ZoneUpdateInput = Partial<Omit<ZoneCreateInput, 'polygon'>> & {
  polygon?: ZonePoint[];
  visible?: boolean;
};

export const zonesApi = {
  async list(): Promise<Zone[]> {
    const res = await apiClient.get<ApiZoneListResponse>('/fleet-admin/zones?limit=100');
    return (res.data ?? []).map(mapApiZone);
  },

  async create(input: ZoneCreateInput): Promise<Zone> {
    const res = await apiClient.post<ApiZoneSingleResponse>('/fleet-admin/zones', {
      name_en:     input.name_en,
      name_ar:     input.name_ar,
      type:        input.type,
      speed_limit: input.speedLimitKmh || null,
      coordinates: pointsToWkt(input.polygon),
      is_active:   input.active,
    });
    return mapApiZone(res.data);
  },

  async update(id: string, updates: ZoneUpdateInput): Promise<Zone | null> {
    const { visible: _visible, ...rest } = updates;
    if (Object.keys(rest).length === 0) return null; // visible-only — no backend call

    const body: Record<string, unknown> = {};
    if (rest.name_en      !== undefined) body.name_en     = rest.name_en;
    if (rest.name_ar      !== undefined) body.name_ar     = rest.name_ar;
    if (rest.type         !== undefined) body.type        = rest.type;
    if (rest.speedLimitKmh !== undefined) body.speed_limit = rest.speedLimitKmh || null;
    if (rest.active       !== undefined) body.is_active   = rest.active;
    if (rest.polygon      !== undefined) body.coordinates = pointsToWkt(rest.polygon);

    const res = await apiClient.put<ApiZoneSingleResponse>(`/fleet-admin/zones/${id}`, body);
    return mapApiZone(res.data);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/fleet-admin/zones/${id}`);
  },

  async restore(zone: Zone): Promise<Zone> {
    return zonesApi.create({
      name_en:      zone.name_en,
      name_ar:      zone.name_ar,
      type:         zone.type,
      speedLimitKmh: zone.speedLimitKmh,
      active:       zone.active,
      polygon:      zone.polygon,
    });
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
  /** Money: a scalar on older responses, a currency-aware object on current ones. */
  average_cost_per_motorcycle?: number | string | ApiMoneyFields | null;
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

    // Average cost per vehicle is money. It arrives either as a bare scalar or as
    // the currency-aware object, and rendering the object would print
    // "[object Object]" — resolve both through integer minor units.
    const rawAvgCost = res.average_cost_per_motorcycle;
    const avgCost = readMoney(
      rawAvgCost !== null && typeof rawAvgCost === 'object'
        ? rawAvgCost
        : { amount: rawAvgCost ?? 0 },
    );

    return {
      activeFleet:             res.total_motorcycles ?? 0,
      availableBatteries:      res.available_batteries ?? 0,
      chargingBatteries:       res.charging_batteries ?? 0,
      lowBatteryCount:         res.low_battery_count ?? 0,
      averageSoc:              res.average_soc ?? 0,
      totalTripsToday:         res.total_trips_today ?? 0,
      avgTripDurationMinutes:  res.avg_trip_duration_minutes ?? 0,
      successRate:             res.success_rate ?? 0,
      averageCostPerVehicle:   moneyToNumber(avgCost),
      // Trend fields — backend uses short names (fleet_trend, batteries_trend…)
      // Fall back to legacy long names in case the API version changes
      fleetTrend:              res.fleet_trend     ?? res.total_motorcycles_trend         ?? 0,
      driversTrend:            res.drivers_trend ?? 0,
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
  /** Fixed-precision string in the fleet's currency. */
  revenue?: string | number;
  currency?: string | null;
  decimals?: number | null;
}

interface ApiMonthlyRevenue {
  month?: string;
  date?: string;
  label?: string;
  /** Fixed-precision string in the fleet's currency. */
  revenue?: string | number;
  currency?: string | null;
  decimals?: number | null;
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
  /** Fixed-precision string in the fleet's currency. */
  amount?: string | number;
  value?: string | number;
  currency?: string | null;
  decimals?: number | null;
  color?: string;
}

interface ApiTopDriver {
  driver_id?: number | string;
  user_id?: number | string;
  name?: string;
  trips_count?: number;
  trips?: number;
  swaps_count?: number;
  swaps?: number;
  charges_count?: number;
  charges?: number;
  activity?: number;        // real field: swaps + charges, used for ranking
}

const COST_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const reportsApi = {
  async getWeeklyTrips(): Promise<{ day: string; trips: number; revenue: number }[]> {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/weekly-trips');
    return extractList<ApiWeeklyTrip>(raw).map((r) => ({
      day:     r.label ?? r.day ?? '',
      trips:   r.trips_count ?? r.trips ?? 0,
      revenue: moneyToNumber(readMoney({ amount: r.revenue, currency: r.currency, decimals: r.decimals })),
    }));
  },

  async getMonthlyRevenue(): Promise<RevenuePoint[]> {
    const now      = new Date();
    const to       = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const from     = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
    const raw = await apiClient.get<unknown>(`/fleet-admin/reports/monthly-revenue?from=${from}&to=${to}`);
    return extractList<ApiMonthlyRevenue>(raw).map((r) => ({
      date:    r.label ?? r.month ?? r.date ?? '',
      revenue: moneyToNumber(readMoney({ amount: r.revenue, currency: r.currency, decimals: r.decimals })),
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
      value:    moneyToNumber(readMoney({ amount: c.amount ?? c.value, currency: c.currency, decimals: c.decimals })),
      color:    c.color ?? COST_COLORS[i % COST_COLORS.length],
    }));
  },

  // Backend ranks by `activity` (swaps + charges); there is no per-driver revenue.
  async getTopDrivers(): Promise<
    { name: string; swaps: number; charges: number; activity: number }[]
  > {
    const raw = await apiClient.get<unknown>('/fleet-admin/reports/top-drivers?limit=10');
    return extractList<ApiTopDriver>(raw).map((d) => {
      const swaps   = d.swaps   ?? d.swaps_count   ?? 0;
      const charges = d.charges ?? d.charges_count ?? 0;
      return {
        name:     d.name ?? 'Unknown',
        swaps,
        charges,
        activity: d.activity ?? swaps + charges,
      };
    });
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

/** Rows per request when the caller doesn't say. Matches the table's page size. */
const DEFAULT_PER_PAGE = 15;
/** Rows per request when walking the paginator — fewer round trips. */
const MAX_PER_PAGE = 100;
/**
 * Hard stop when walking the paginator: 50 × 100 = 5 000 rows.
 *
 * A backstop, not a business rule. Hitting it is reported to the caller and
 * logged, never swallowed — an export that quietly stops at the cap reads as
 * "this is the whole ledger" when it isn't.
 */
const MAX_TRANSACTION_PAGES = 50;

/** Pagination state of one response. */
export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  /** Rows matching the filters across all pages. */
  total: number;
}

/**
 * Filters `GET /fleet-admin/wallet/transactions` accepts.
 *
 * `from`, `to`, `driver_id`, `type`, `status` and `per_page` are the documented
 * set; `page` is the Laravel paginator's own cursor. `type` takes the backend's
 * vocabulary — see {@link apiTransactionType}.
 */
export interface WalletTransactionQuery {
  from?: string;
  to?: string;
  driverId?: string;
  /** Backend vocabulary: 'credit' | 'debit' | 'refund'. */
  type?: string;
  status?: string;
  perPage?: number;
  page?: number;
}

function walletQueryString(params: WalletTransactionQuery): string {
  const qs = new URLSearchParams();
  if (params.from)     qs.set('from',      params.from);
  if (params.to)       qs.set('to',        params.to);
  if (params.driverId) qs.set('driver_id', params.driverId);
  if (params.type   && params.type   !== 'all') qs.set('type',   params.type);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  qs.set('per_page', String(params.perPage ?? DEFAULT_PER_PAGE));
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  return qs.toString();
}

/**
 * Pagination state, wherever Laravel put it.
 *
 * The paginator turns up at the root (`{ meta: {...} }`), inside `data`
 * (`{ data: { current_page, data: [...] } }`) or flattened onto the root — and
 * some fleet-admin endpoints return a bare array with no meta at all. A response
 * with no paginator is treated as a single complete page, which is what a bare
 * array is.
 */
function extractPageMeta(raw: unknown, rowCount: number, perPage: number): PageMeta {
  const single: PageMeta = { currentPage: 1, lastPage: 1, perPage, total: rowCount };
  if (!raw || typeof raw !== 'object') return single;

  const root  = raw as Record<string, unknown>;
  const inner = (root['data'] && typeof root['data'] === 'object' && !Array.isArray(root['data']))
    ? root['data'] as Record<string, unknown>
    : undefined;

  const source = [root['meta'], inner, root].find(
    (c) => c && typeof c === 'object' && 'current_page' in (c as Record<string, unknown>),
  ) as Record<string, unknown> | undefined;
  if (!source) return single;

  const readInt = (v: unknown, fallback: number): number => {
    const n = num(v);
    return n !== undefined && n > 0 ? Math.floor(n) : fallback;
  };
  const resolvedPerPage = readInt(source['per_page'], perPage);
  return {
    currentPage: readInt(source['current_page'], 1),
    lastPage:    readInt(source['last_page'], 1),
    perPage:     resolvedPerPage,
    total:       readInt(source['total'], rowCount),
  };
}

/**
 * Our UI category translated into the backend's `type` filter, plus whether the
 * server can express it exactly.
 *
 * The vocabularies do not line up. The backend stores `credit` / `debit`, and a
 * debit only becomes a *fast charge* or a *battery swap* once `reference_type`
 * is read — which `mapTransaction` does here, not there. So the two debit
 * sub-kinds narrow to `debit` on the server and must be finished off locally;
 * `exact: false` tells the caller it has to walk every page to be complete.
 */
export function apiTransactionType(
  uiType: TransactionType | 'all',
): { param?: string; exact: boolean } {
  switch (uiType) {
    case 'top_up':       return { param: 'credit', exact: true };
    case 'refund':       return { param: 'refund', exact: true };
    case 'fast_charge':
    case 'battery_swap': return { param: 'debit',  exact: false };
    case 'all':
    default:             return { exact: true };
  }
}

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

// ── Top-up options (minimum + suggested chips) ───────────────────────────────

/** `GET /fleet-admin/wallet/topup-options` as the backend serialises it. */
interface ApiTopUpOptions {
  currency?:         string | null;
  decimals?:         number | null;
  balance?:          ApiMoneyFields | string | number | null;
  min_topup?:        ApiMoneyFields | string | number | null;
  min_topup_reason?: string | null;
  suggested_amounts?: Array<ApiMoneyFields | string | number> | null;
  service_prices?:   unknown;
}

/**
 * Read one amount out of the options envelope.
 *
 * Each field may arrive either as a full money object or as a bare
 * fixed-precision string alongside the envelope's own `currency`/`decimals`.
 * The envelope only ever fills gaps — a nested object that states its own
 * currency wins, exactly as {@link readMoney} treats `decimals`.
 */
function readEnvelopeMoney(
  value: ApiMoneyFields | string | number | null | undefined,
  currency: string | null,
  decimals: number | null,
): Money {
  if (value !== null && typeof value === 'object') {
    return readMoney({
      ...value,
      currency: value.currency ?? currency,
      decimals: value.decimals ?? decimals,
    });
  }
  return readMoney({ amount: value ?? null, currency, decimals });
}

function readMinTopUpReason(raw: unknown): MinTopUpReason | null {
  return raw === 'below_service_price' || raw === 'absolute_floor' ? raw : null;
}

/**
 * `service_prices` in either shape the backend might send: a keyed map
 * (`{ battery_swap: "1.500" }`) or a list of records. Unknown keys survive —
 * the modal falls back to the backend's own label for anything it cannot name.
 */
function mapServicePrices(raw: unknown, currency: string | null, decimals: number | null): ServicePrice[] {
  if (!raw || typeof raw !== 'object') return [];

  const entries: Array<[string, unknown]> = Array.isArray(raw)
    ? raw.map((item, i) => {
        const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const key = rec.key ?? rec.service ?? rec.type ?? rec.name ?? i;
        return [String(key), item];
      })
    : Object.entries(raw as Record<string, unknown>);

  return entries.map(([key, value]) => {
    const rec = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const label = typeof rec.label === 'string' ? rec.label : undefined;
    // A list entry holds its amount under `price`/`amount`; a map entry *is* the amount.
    const amount = (rec.price ?? value) as ApiMoneyFields | string | number | null;
    return { key, label, price: readEnvelopeMoney(amount, currency, decimals) };
  });
}

/**
 * The `422 topup_below_minimum` a top-up is rejected with, or **null** for any
 * other failure.
 *
 * The backend states the current minimum in `meta.min_topup`, so this belongs on
 * the amount field with that number — never on a generic error banner, and never
 * with the stale minimum the form happened to be holding.
 */
export function topUpBelowMinimumFrom(
  err: unknown,
): { minTopUp: Money | null; reason: MinTopUpReason | null; message: string } | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  if (err.code !== 'topup_below_minimum') return null;

  const meta     = err.meta ?? {};
  const currency = typeof meta.currency === 'string' ? meta.currency : null;
  const decimals = typeof meta.decimals === 'number' ? meta.decimals : null;
  const raw      = meta.min_topup as ApiMoneyFields | string | number | null | undefined;

  return {
    minTopUp: raw != null ? readEnvelopeMoney(raw, currency, decimals) : null,
    reason:   readMinTopUpReason(meta.min_topup_reason),
    message:  err.message,
  };
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

  /**
   * One page of transactions, with the paginator's own totals.
   *
   * The page used to fetch `per_page=100` and never look further, then filter
   * and export over that capped array — so filters and the CSV were both
   * silently incomplete, and the driver dropdown (built from the same 100 rows)
   * could not even offer a driver whose activity fell past the cap.
   */
  async getTransactions(
    params: WalletTransactionQuery = {},
  ): Promise<{ rows: WalletTransaction[]; page: PageMeta }> {
    const raw = await apiClient.get<unknown>(
      `/fleet-admin/wallet/transactions?${walletQueryString(params)}`,
    );
    const rows = extractList<ApiTransaction>(raw).map(mapTransaction);
    return { rows, page: extractPageMeta(raw, rows.length, params.perPage ?? DEFAULT_PER_PAGE) };
  },

  /**
   * Every transaction matching `params`, by walking the paginator.
   *
   * For the CSV export and for the filters the backend cannot express exactly
   * (see {@link apiTransactionType}). `truncated` is true when the page cap was
   * reached — the caller must surface that rather than present a short export as
   * the whole ledger.
   */
  async getAllTransactions(
    params: WalletTransactionQuery = {},
    maxPages = MAX_TRANSACTION_PAGES,
  ): Promise<{ rows: WalletTransaction[]; truncated: boolean }> {
    const perPage = params.perPage ?? MAX_PER_PAGE;
    const rows: WalletTransaction[] = [];

    let page = 1;
    let lastPage = 1;
    do {
      const res = await walletApi.getTransactions({ ...params, perPage, page });
      rows.push(...res.rows);
      lastPage = res.page.lastPage;
      // A backend that ignores `page` would hand back page 1 forever; stopping on
      // an empty response keeps that from spinning.
      if (res.rows.length === 0) break;
      page += 1;
    } while (page <= lastPage && page <= maxPages);

    const truncated = lastPage > maxPages;
    if (truncated) {
      logger.warn(
        `[Wallet] Stopped after ${maxPages} pages of ${lastPage}; ` +
        'the result is incomplete. Narrow the date range.',
      );
    }
    return { rows, truncated };
  },

  async getBalance(driverId: string): Promise<number> {
    const res = await apiClient.get<{ data?: ApiMoneyFields } & ApiMoneyFields>(
      `/fleet-admin/wallet/balance/${driverId}`,
    );
    // Backend wraps response:
    // { success, data: { driver_id, name, balance, currency, minor_units, decimals } }
    const inner = (res.data && typeof res.data === 'object') ? res.data : res;
    return moneyToNumber(readMoney(inner));
  },

  /**
   * Everything the top-up form needs for one driver: the minimum, why it is what
   * it is, and the quick-amount chips.
   *
   * `suggested_amounts` is passed through untouched. The backend has already
   * removed the chips below the minimum and prepended the minimum itself, so
   * filtering or re-sorting here would only produce a set the server disagrees
   * with — and in a three-decimal currency that disagreement is invisible until
   * a payment is rejected.
   */
  async getTopUpOptions(driverId: string): Promise<TopUpOptions> {
    const res = await apiClient.get<{ data?: ApiTopUpOptions } & ApiTopUpOptions>(
      `/fleet-admin/wallet/topup-options?driver_id=${encodeURIComponent(driverId)}`,
    );
    const d: ApiTopUpOptions = (res.data && typeof res.data === 'object') ? res.data : res;

    const currency = d.currency ?? null;
    const decimals = typeof d.decimals === 'number' ? d.decimals : null;

    return {
      currency,
      decimals,
      balance:        readEnvelopeMoney(d.balance,   currency, decimals),
      minTopUp:       readEnvelopeMoney(d.min_topup, currency, decimals),
      minTopUpReason: readMinTopUpReason(d.min_topup_reason),
      suggestedAmounts: (Array.isArray(d.suggested_amounts) ? d.suggested_amounts : [])
        .map((a) => readEnvelopeMoney(a, currency, decimals)),
      servicePrices:  mapServicePrices(d.service_prices, currency, decimals),
    };
  },

  /**
   * Step 1 — Call BEFORE showing the Moyasar form.
   * Backend provisions the pending wallet transaction and returns everything
   * Moyasar.init() needs, including the metadata object that links the payment
   * back to the wallet transaction.  Do NOT build your own metadata.
   */
  async initiateTopUp(params: {
    driverId:  string;
    amount:    number;
    saveCard?: boolean;   // ask backend/Moyasar to tokenize this card for reuse
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
      save_card: params.saveCard ?? false,
    });

    if (res.success === false) throw new Error(res.message ?? 'Top-up initiation failed');

    const d  = res.data ?? {};
    const pd = d.payment_data ?? {};

    // A payment must never proceed on a guessed currency. Defaulting to SAR here
    // would hand the gateway "SAR" for a JOD charge — an actual mischarge, not a
    // rendering bug — so fail before any payment is attempted.
    if (!pd.currency) {
      throw new Error(
        'Top-up initiation returned no currency (data.payment_data.currency is missing). ' +
        'Refusing to start a payment without one.',
      );
    }

    return {
      walletTransactionUuid: d.wallet_transaction_uuid ?? '',
      paymentData: {
        amount:         pd.amount         ?? 0,
        currency:       pd.currency,
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

  // ── Saved cards (Moyasar tokens) ───────────────────────────────────────────
  //
  // Cards are tokenized by Moyasar and stored against the fleet account, so they
  // can be reused to top up any driver. The raw card number never reaches us.
  //
  // ⚠️ Backend not yet implemented — these call the agreed contracts below.
  // Until the routes exist, `getSavedCards` resolves to [] (so the UI degrades
  // to "add new card") and `chargeSavedCard` surfaces the backend error.

  /** List cards the fleet account has saved. Endpoint: GET /fleet-admin/wallet/saved-cards */
  async getSavedCards(): Promise<SavedCard[]> {
    try {
      const raw = await apiClient.get<unknown>('/fleet-admin/wallet/saved-cards');
      return extractList<{
        id?:         number | string;
        brand?:      string;
        company?:    string;
        last_four?:  string;
        last4?:      string;
        name?:       string;
        exp_month?:  number | string;
        exp_year?:   number | string;
      }>(raw).map((c) => ({
        id:       String(c.id ?? ''),
        brand:    (c.brand ?? c.company ?? 'card').toLowerCase(),
        last4:    String(c.last_four ?? c.last4 ?? '••••'),
        name:     c.name,
        expMonth: c.exp_month != null ? Number(c.exp_month) : undefined,
        expYear:  c.exp_year  != null ? Number(c.exp_year)  : undefined,
      })).filter((c) => c.id);
    } catch {
      // Backend route may not exist yet — degrade gracefully to "no saved cards".
      return [];
    }
  },

  /** Forget a saved card. Endpoint: DELETE /fleet-admin/wallet/saved-cards/{id} */
  async deleteSavedCard(cardId: string): Promise<void> {
    await apiClient.delete(`/fleet-admin/wallet/saved-cards/${cardId}`);
  },

  /**
   * Charge a previously-saved card. Charging a token MUST happen server-side
   * (it needs the Moyasar secret key), so this hits a backend endpoint that
   * performs the charge and may return a 3DS `transactionUrl` to redirect to.
   * Endpoint: POST /fleet-admin/wallet/top-up/charge-saved
   */
  async chargeSavedCard(params: {
    driverId: string;
    amount:   number;
    cardId:   string;
  }): Promise<{
    status:          string;
    transactionUrl?: string;   // present when 3DS authentication is required
    paymentId?:      string;
    amount?:         number;
    balance?:        number;
  }> {
    const res = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: {
        status?:          string;
        transaction_url?: string;
        payment_id?:      string;
        amount?:          number;
        balance?:         number;
      };
    }>('/fleet-admin/wallet/top-up/charge-saved', {
      driver_id: Number(params.driverId),
      amount:    params.amount,
      card_id:   params.cardId,
    });

    if (res.success === false) throw new Error(res.message ?? 'Could not charge the saved card.');

    const d = res.data ?? {};
    return {
      status:         d.status ?? 'failed',
      transactionUrl: d.transaction_url || undefined,
      paymentId:      d.payment_id,
      amount:         d.amount,
      balance:        d.balance,
    };
  },

  async topUp(
    driverId: string,
    amount: number,
    _paymentMethod: string,
    note?: string,
  ): Promise<Driver> {
    const res = await apiClient.post<{
      data?: { driver_id?: number | string } & ApiMoneyFields;
    }>('/fleet-admin/wallet/top-up', { driver_id: Number(driverId), amount, note });
    // Response: { success, data: { driver_id, name, amount, balance, currency,
    //                              minor_units, decimals, note } }
    // No full driver object — extract the new balance and return a stub for merging
    const data = (res.data && typeof res.data === 'object') ? res.data : {};
    // `balance` is the post-top-up total; fall back to the amount we just sent.
    // `minor_units` on this payload describes the top-up amount, not the balance,
    // so it is deliberately not forwarded here.
    const newBalance = data.balance != null
      ? parseAmount(
          data.balance,
          data.decimals ?? decimalsForCurrency(data.currency) ?? fractionDigitsOf(data.balance),
        )
      : amount;
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

// ─────────────────────────────────────────────────────────────────────────────
// IoT Devices API
//
// NOTE: field names below are mapped DEFENSIVELY (multiple fallbacks) because the
// exact backend response shape has not been confirmed yet. Once a real sample is
// available, tighten these mappers. See docs/BACKEND_GAPS.md (A2).
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce a possibly-string number into a real number, or undefined. */
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

type RawDevice = Record<string, any>;

function mapDevice(d: RawDevice): IoTDevice {
  // Real API nests: assigned_motorcycle, latest_gps, latest_battery.
  const moto = d.assigned_motorcycle ?? d.motorcycle ?? {};
  const gps = d.latest_gps ?? {};
  const battery = d.latest_battery ?? {};
  const isOnline =
    typeof d.is_online === 'boolean' ? d.is_online
    : (d.status ?? d.connection_status) === 'online';
  const gpsSignal = (gps.gps_signal ?? d.gps_signal ?? d.signal ?? 'strong') as IoTDevice['gpsSignal'];
  return {
    id:              String(d.id ?? d.device_id ?? d.imei ?? ''),
    deviceId:        String(d.device_id ?? d.imei ?? d.serial ?? d.id ?? ''),
    motorcycleId:    moto.id != null ? String(moto.id) : (d.motorcycle_id != null ? String(d.motorcycle_id) : undefined),
    motorcyclePlate: moto.plate_number ?? moto.plate ?? d.plate_number ?? undefined,
    status:          (isOnline ? 'online' : 'offline') as DeviceStatus,
    batteryLevel:    num(battery.soc ?? battery.relative_soc ?? d.battery_level ?? d.battery ?? d.soc ?? moto.battery_level),
    gpsSignal:       (['strong', 'weak', 'none'].includes(gpsSignal) ? gpsSignal : 'strong') as IoTDevice['gpsSignal'],
    latitude:        num(gps.latitude ?? d.latitude ?? d.lat),
    longitude:       num(gps.longitude ?? d.longitude ?? d.lng ?? d.lon),
    speedKmh:        num(gps.speed ?? d.speed_kmh ?? d.speed),
    lastSeenAt:      d.last_seen_at ?? d.last_seen ?? d.updated_at ?? undefined,
  };
}

export const iotDevicesApi = {
  /** List devices. Optional status filter: 'online' | 'offline'. */
  async list(status?: DeviceStatus, perPage = 50): Promise<IoTDevice[]> {
    const qs = new URLSearchParams({ per_page: String(perPage) });
    if (status) qs.set('status', status);
    const raw = await apiClient.get<unknown>(`/fleet-admin/iot-devices?${qs.toString()}`);
    return extractList<RawDevice>(raw).map(mapDevice);
  },

  async get(id: string): Promise<IoTDevice | null> {
    try {
      const res = await apiClient.get<{ data?: RawDevice } | RawDevice>(`/fleet-admin/iot-devices/${id}`);
      const raw = (res as { data?: RawDevice }).data ?? (res as RawDevice);
      return mapDevice(raw);
    } catch {
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Alarms API  (defensive mapping — see docs/BACKEND_GAPS.md A3)
// ─────────────────────────────────────────────────────────────────────────────

type RawAlarm = Record<string, any>;

function toAlarmSeverity(s?: string): AlarmSeverity {
  const v = (s ?? '').toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'error' || v === 'danger') return 'critical';
  if (v === 'warning' || v === 'medium' || v === 'warn') return 'warning';
  return 'info';
}

function mapAlarm(a: RawAlarm): Alarm {
  const resolved =
    a.status === 'resolved' || a.is_resolved === true || a.resolved === true || a.resolved_at != null;
  // Real API nests the bike under iot_device.assigned_motorcycle.
  const moto = a.iot_device?.assigned_motorcycle ?? a.motorcycle ?? {};
  return {
    id:           String(a.id ?? ''),
    type:         String(a.type ?? a.alarm_type ?? a.code ?? 'unknown'),
    title:        a.title ?? a.name ?? a.message ?? a.type ?? 'Alarm',
    description:  a.description ?? a.details ?? a.message ?? undefined,
    severity:     toAlarmSeverity(a.severity ?? a.level ?? a.priority),
    status:       (resolved ? 'resolved' : 'unresolved') as AlarmStatus,
    motorcycleId: moto.id != null ? String(moto.id) : (a.motorcycle_id != null ? String(a.motorcycle_id) : undefined),
    deviceId:     a.iot_device?.id != null ? String(a.iot_device.id) : (a.device_id != null ? String(a.device_id) : undefined),
    // Real API timestamp is `recorded_at`.
    createdAt:    a.recorded_at ?? a.created_at ?? a.triggered_at ?? a.timestamp ?? new Date().toISOString(),
    resolvedAt:   a.resolved_at ?? undefined,
  };
}

export const alarmsApi = {
  /** List alarms. Optional status filter: 'unresolved' | 'resolved'. */
  async list(status?: AlarmStatus, perPage = 50): Promise<Alarm[]> {
    const qs = new URLSearchParams({ per_page: String(perPage) });
    if (status) qs.set('status', status);
    const raw = await apiClient.get<unknown>(`/fleet-admin/alarms?${qs.toString()}`);
    return extractList<RawAlarm>(raw).map(mapAlarm);
  },

  /** Mark an alarm resolved. Returns true on success. */
  async resolve(id: string): Promise<boolean> {
    try {
      await apiClient.post(`/fleet-admin/alarms/${id}/resolve`);
      return true;
    } catch {
      return false;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sessions API — driver swap / charging activity (defensive; see BACKEND_GAPS A4)
// ─────────────────────────────────────────────────────────────────────────────

type RawSession = Record<string, any>;

function toSessionStatus(s?: string): SessionStatus {
  const v = (s ?? '').toLowerCase();
  if (v === 'completed' || v === 'success' || v === 'done' || v === 'finished') return 'completed';
  if (v === 'cancelled' || v === 'canceled') return 'cancelled';
  if (v === 'failed' || v === 'error') return 'failed';
  return 'in_progress';
}

function mapSession(kind: SessionKind, s: RawSession): DriverSession {
  // Real API: driver is `user`; station is `station` (swaps) or `pile` (charging).
  const driver = s.user ?? s.driver ?? {};
  const station = s.station ?? s.pile ?? s.cabinet ?? {};
  return {
    id:          String(s.id ?? ''),
    kind,
    driverId:    driver.id != null ? String(driver.id) : (s.driver_id != null ? String(s.driver_id) : undefined),
    driverName:  driver.name ?? s.driver_name ?? undefined,
    stationName: station.name ?? s.station_name ?? s.cabinet_name ?? undefined,
    status:      toSessionStatus(s.status),
    startedAt:   s.started_at ?? s.created_at ?? s.start_time ?? undefined,
    // Real API: `completed_at`.
    endedAt:     s.completed_at ?? s.ended_at ?? s.end_time ?? undefined,
    // Real API: swaps use `swap_fee`, charging uses `final_amount`.
    amount:      num(s.swap_fee ?? s.final_amount ?? s.amount ?? s.cost ?? s.total ?? s.price),
  };
}

interface SessionFilters {
  status?: SessionStatus;
  driverId?: string;
  from?: string;
  to?: string;
  perPage?: number;
}

function sessionQuery(f?: SessionFilters): string {
  const qs = new URLSearchParams({ per_page: String(f?.perPage ?? 50) });
  if (f?.status)   qs.set('status', f.status);
  if (f?.driverId) qs.set('driver_id', f.driverId);
  if (f?.from)     qs.set('from', f.from);
  if (f?.to)       qs.set('to', f.to);
  return qs.toString();
}

export const sessionsApi = {
  async swaps(filters?: SessionFilters): Promise<DriverSession[]> {
    const raw = await apiClient.get<unknown>(`/fleet-admin/sessions/swaps?${sessionQuery(filters)}`);
    return extractList<RawSession>(raw).map((s) => mapSession('swap', s));
  },

  async charging(filters?: SessionFilters): Promise<DriverSession[]> {
    const raw = await apiClient.get<unknown>(`/fleet-admin/sessions/charging?${sessionQuery(filters)}`);
    return extractList<RawSession>(raw).map((s) => mapSession('charging', s));
  },
};
