// ============================================================================
// Domain Types — central contract for the entire application
// ============================================================================

// ----- Country & money primitives ---------------------------------------------

/**
 * Phone dial prefix, e.g. '+966'. The API calls this `country_code`, which is a
 * misnomer — it identifies a numbering plan, not a country. Display use only.
 *
 * Branded so it can never be passed where an {@link IsoCountryCode} is expected.
 * Mint one with `toDialCode()` from @/lib/country.
 */
export type DialCode = string & { readonly __brand: 'DialCode' };

/**
 * ISO 3166-1 alpha-2 country code, e.g. 'SA' | 'JO'. The API calls this
 * `iso_country_code`. This is the field that resolves a country — currency,
 * phone rules, vehicle terminology.
 *
 * Branded so it can never be passed where a {@link DialCode} is expected.
 * Mint one with `toIsoCountryCode()` from @/lib/country.
 */
export type IsoCountryCode = string & { readonly __brand: 'IsoCountryCode' };

/** ISO 4217 currency code, e.g. 'SAR' | 'JOD'. */
export type CurrencyCode = string;

/**
 * A country as `GET /countries` describes it (API root, no token).
 *
 * The phone facts are the point of this record: the app must not carry its own
 * idea of what a valid mobile number looks like. `phoneRegex` is the backend's
 * rule for the **national** number — the digits after the dial code, with no
 * trunk `0` — and it is the only validation the phone fields run.
 *
 * `currency` is optional here because a country is not a fleet: the fleet's own
 * currency comes from `GET /fleet-admin/me` via `useFleetContext()`, and nothing
 * may fall back to a country's currency to render a fleet's money.
 */
export interface Country {
  isoCountryCode: IsoCountryCode;
  dialCode: DialCode;
  nameEn: string;
  nameAr: string;
  currency?: CurrencyCode;
  currencyDecimals?: number;
  /** Backend rule for the national number, e.g. '^5[0-9]{8}$'. */
  phoneRegex: string;
  /** Input mask for the national number, e.g. '5X XXX XXXX'. */
  phonePlaceholder: string;
  /** A national number that satisfies `phoneRegex`, e.g. '512345678'. */
  phoneExampleNational: string;
  /** Digit count of a national number — sizes and caps the input. */
  nationalNumberLength: number;
}

/**
 * A fixed-precision monetary value.
 *
 * Mirrors the backend's money object
 * `{ amount|balance: "120.500", currency, minor_units, decimals }`.
 * Build one with `readMoney()` from @/lib/money — never with parseFloat.
 */
export interface Money {
  /** Exact fixed-precision decimal string, e.g. '120.500'. */
  amount: string;
  /** Integer minor units — the only representation safe for arithmetic. */
  minorUnits: number;
  /** ISO 4217 code as sent by the backend; null when the payload omitted it. */
  currency: CurrencyCode | null;
  /** Minor-unit exponent. SAR = 2, JOD = 3. */
  decimals: number;
}

/**
 * The fleet's own profile, from `GET /fleet-admin/me`.
 *
 * This is the single source for the fleet's country and currency. A fleet's
 * country is fixed on its fleet record and is never client-selectable.
 */
export interface FleetProfile {
  id: string;
  name: string;
  isoCountryCode: IsoCountryCode | null;
  currency: CurrencyCode;
  currencyDecimals: number;
  maxDrivers?: number;
  status?: string;
}

export type VehicleStatus = 'active' | 'charging' | 'idle' | 'maintenance';
export type StationStatus = 'available' | 'charging' | 'in_use';
export type DriverStatus = 'active' | 'inactive' | 'pending' | 'blocked';

/**
 * Sessions cancelled as a side effect of blocking / deactivating a driver.
 * Present on block and toggle-status→inactive responses; absent on unblock,
 * reactivation, and older responses — always treat as optional.
 */
export interface CancelledSessions {
  swap_sessions: number[];
  charging_sessions: number[];
}

/** Result of a block / toggle-status status change. */
export interface DriverStatusChangeResult {
  status: DriverStatus;
  cancelled_sessions?: CancelledSessions;
}
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
  /**
   * Last known position, **absent when nothing has ever reported one**.
   *
   * There is deliberately no fallback coordinate: a vehicle that has never sent
   * GPS is not "in Riyadh", it is unlocated. Consumers must exclude it from maps
   * and say so in lists rather than draw it somewhere plausible.
   */
  coordinates?: { lat: number; lng: number };
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
  /** As recorded, `''` when unknown. Never defaulted to a city we guessed. */
  city: string;
  /** @see Vehicle.coordinates — absent means unlocated, not "somewhere central". */
  coordinates?: { lat: number; lng: number };
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
    fileUrl?: string;
    backFileUrl?: string;
    rejectionReason?: string;
  };
  customsCard: {
    status: DocumentStatus;
  };
  plate: {
    status: DocumentStatus;
    number?: string;
    fileUrl?: string;
    rejectionReason?: string;
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
  /** Dial prefix from the API's `country_code`, e.g. '+966'. Display only. */
  dialCode?: DialCode;
  /** ISO 3166-1 alpha-2 from the API's `iso_country_code`. Resolves the country. */
  isoCountryCode?: IsoCountryCode;
  email?: string;
  address?: string;
  city?: string;
  vehicleModel: string;
  /** Id of the motorcycle currently assigned to this driver, if any. */
  assignedMotorcycleId?: string;
  /** Plate number of the assigned motorcycle, for display. */
  assignedMotorcyclePlate?: string;
  status: DriverStatus;
  trips: number;
  totalCost: number;
  charges: number;
  swaps: number;
  walletBalance: number;
  avatarUrl?: string;
  /**
   * When the driver record was created, if the endpoint returns it.
   * `GET /fleet-admin/drivers` does not today, so newest/oldest ordering falls
   * back to the autoincrement id, which is creation order by construction.
   */
  createdAt?: string;
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
  driversTrend: number;
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

// ----- IoT Devices ------------------------------------------------------------

export type DeviceStatus = 'online' | 'offline';

export interface IoTDevice {
  id: string;
  /** Hardware identifier (IMEI / serial), as reported by the backend. */
  deviceId: string;
  motorcycleId?: string;
  motorcyclePlate?: string;
  status: DeviceStatus;
  /** Battery level of the paired motorcycle, 0–100. */
  batteryLevel?: number;
  gpsSignal: 'strong' | 'weak' | 'none';
  latitude?: number;
  longitude?: number;
  speedKmh?: number;
  lastSeenAt?: string;
}

// ----- Alarms -----------------------------------------------------------------

export type AlarmStatus = 'unresolved' | 'resolved';
export type AlarmSeverity = 'critical' | 'warning' | 'info';

export interface Alarm {
  id: string;
  /** Raw backend type code, e.g. 'low_battery', 'geofence_breach'. */
  type: string;
  title: string;
  description?: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  motorcycleId?: string;
  deviceId?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ----- Driver Sessions (swap / charging activity) -----------------------------

export type SessionKind = 'swap' | 'charging';
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface DriverSession {
  id: string;
  kind: SessionKind;
  driverId?: string;
  driverName?: string;
  stationName?: string;
  status: SessionStatus;
  startedAt?: string;
  endedAt?: string;
  /** Cost of the session, when applicable. */
  amount?: number;
}

// ----- Wallet ----------------------------------------------------------------

export type TransactionType   = 'top_up' | 'fast_charge' | 'battery_swap' | 'refund';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

/**
 * Which way the money moved: `'in'` = credit / refund, `'out'` = debit.
 *
 * The backend's confirmed convention is that **a debit is a positive amount with
 * `type: "debit"`, never a negative** — so the sign of `amount` carries no
 * information and must never be used to tell a debit from a credit. Colour,
 * sign prefixes and any ledger arithmetic key off this field.
 */
export type TransactionDirection = 'in' | 'out';

export interface WalletTransaction {
  id: string;
  createdAt: string;
  driverName: string;
  driverId: string;
  /**
   * Magnitude only — always ≥ 0, because that is how the backend sends it.
   * Pair it with {@link WalletTransaction.direction} to know the sign.
   */
  amount: number;
  /**
   * The exact fixed-precision value behind `amount`, as the backend sent it.
   * Use this for sums, CSV export and anything that must not drift; `amount` is
   * the lossy convenience view. Absent on locally-constructed fixtures.
   */
  money?: Money;
  /** Credit or debit. The only safe source of the sign. */
  direction: TransactionDirection;
  /**
   * The backend's `signed_amount` — an exact decimal string carrying the sign
   * ('-3.250' for a debit). Derived from `direction` + `money` when the payload
   * predates the field, so it is always populated and always agrees with
   * `direction`.
   */
  signedAmount: string;
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

/**
 * A tokenized card the fleet account has chosen to save for future top-ups.
 * The raw PAN never reaches our servers — Moyasar tokenizes it and the backend
 * stores only this non-sensitive descriptor plus an opaque token.
 */
export interface SavedCard {
  id: string;          // backend record id (used to charge / delete)
  brand: string;       // 'visa' | 'mastercard' | 'mada' | 'amex' | ...
  last4: string;       // last four digits, e.g. '1121'
  name?: string;       // name on card, if captured
  expMonth?: number;   // 1-12
  expYear?: number;    // 4-digit year
}

/**
 * Why the backend refuses a top-up below {@link TopUpOptions.minTopUp}.
 *
 * - `below_service_price` — the wallet must end up able to pay for at least one
 *   swap or one fast charge, so the floor is derived from the service prices.
 * - `absolute_floor` — a flat per-country minimum, unrelated to what the driver
 *   can currently afford.
 *
 * Anything else the backend adds later parses to `null`, which renders the plain
 * "minimum is X" message rather than a wrong explanation.
 */
export type MinTopUpReason = 'below_service_price' | 'absolute_floor';

/** What one chargeable service costs, from `topup-options.service_prices`. */
export interface ServicePrice {
  /** Backend key, e.g. 'battery_swap' | 'fast_charge'. */
  key: string;
  /** Backend-supplied display name, when it sends one. */
  label?: string;
  price: Money;
}

/**
 * `GET /fleet-admin/wallet/topup-options?driver_id={id}` — everything the top-up
 * form needs that depends on *this* driver's balance.
 *
 * The minimum is a function of the balance (a driver who cannot afford one swap
 * has to top up further than one who can), so both move together and the options
 * must be re-read whenever the balance changes.
 *
 * `suggestedAmounts` is rendered **verbatim**: the backend has already dropped
 * the chips that fall below `minTopUp` and prepended the minimum itself. Any
 * client-side filtering here would silently disagree with the server.
 */
export interface TopUpOptions {
  /** ISO 4217 code the amounts are denominated in; null when omitted. */
  currency: CurrencyCode | null;
  /** Minor-unit exponent for `currency`; null when the backend omits it. */
  decimals: number | null;
  balance: Money;
  minTopUp: Money;
  minTopUpReason: MinTopUpReason | null;
  /** Quick-amount chips, in the backend's own order. Never re-sorted or filtered. */
  suggestedAmounts: Money[];
  /** Empty when the backend sends no prices — the UI just omits the hint. */
  servicePrices: ServicePrice[];
}

// ----- Battery Swapping -------------------------------------------------------

export interface SwappingStation {
  id: string;
  cabinetId: string;
  name: string;
  district: string;
  /** As recorded, `''` when unknown. Never defaulted to a city we guessed. */
  city: string;
  /** @see Vehicle.coordinates — absent means unlocated, not "somewhere central". */
  coordinates?: { lat: number; lng: number };
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
  /** As recorded, `''` when unknown. Never defaulted to a city we guessed. */
  city: string;
  /** @see Vehicle.coordinates — absent means unlocated, not "somewhere central". */
  coordinates?: { lat: number; lng: number };
  availablePorts: number;
  chargingPorts: number;
  errorPorts: number;
  totalPorts: number;
  avgChargeTimeMinutes: number;
  todaySessions: number;
  status: FastChargingStatus;
}
