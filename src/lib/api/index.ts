/**
 * API layer — currently backed by mock data, but the contract here is what the
 * real backend will implement. To wire up a real API: replace the bodies of these
 * functions with `fetch()` calls. Keep the signatures intact.
 */

import {
  mockBatteryDistribution,
  mockBatteryHealth,
  mockCostAnalysis,
  mockDrivers,
  mockPendingRequests,
  mockMetrics,
  mockMonthlyRevenue,
  mockStations,
  mockTopDrivers,
  mockUsage,
  mockVehicles,
  mockWeeklyTrips,
  mockZones,
  mockSwappingStations,
  mockFastChargingCabinets,
} from '@/lib/mock-data';
import type {
  BatteryStation, Driver, DriverDocuments, DriverRegistrationRequest,
  Vehicle, Zone, ZonePoint, ZoneType,
  SwappingStation, FastChargingCabinet,
} from '@/types';

const DEFAULT_DOCS: DriverDocuments = {
  license:     { status: 'not_uploaded', hasLicense: false },
  customsCard: { status: 'not_uploaded' },
  plate:       { status: 'not_uploaded' },
};

const SIMULATED_DELAY = 200;
const delay = () => new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY));

export const fleetApi = {
  async list(): Promise<Vehicle[]> {
    await delay();
    return mockVehicles;
  },
  async getById(id: string): Promise<Vehicle | null> {
    await delay();
    return mockVehicles.find((v) => v.id === id) ?? null;
  },
  async update(id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
    await delay();
    const index = mockVehicles.findIndex((v) => v.id === id);
    if (index === -1) return null;
    mockVehicles[index] = { ...mockVehicles[index], ...updates };
    return mockVehicles[index];
  },
};

export const stationsApi = {
  async list(): Promise<BatteryStation[]> {
    await delay();
    return mockStations;
  },
};

export interface DriverCreateInput {
  name: string;
  phone: string;
  email?: string;
  vehicleModel: string;
  status: Driver['status'];
  documents?: DriverDocuments;
}

export type DriverUpdateInput = Partial<DriverCreateInput>;

function generateDriverId(): string {
  const max = mockDrivers.reduce((m, d) => {
    const n = parseInt(d.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 1000);
  return `Driv-${max + 1}`;
}

export const driversApi = {
  async list(): Promise<Driver[]> {
    await delay();
    return [...mockDrivers];
  },
  async create(input: DriverCreateInput): Promise<Driver> {
    await delay();
    const driver: Driver = {
      id: generateDriverId(),
      name: input.name,
      phone: input.phone,
      email: input.email,
      vehicleModel: input.vehicleModel,
      status: input.status,
      trips: 0,
      totalCost: 0,
      charges: 0,
      swaps: 0,
      walletBalance: 0,
      documents: input.documents ?? DEFAULT_DOCS,
    };
    mockDrivers.unshift(driver);
    return driver;
  },
  async update(id: string, updates: DriverUpdateInput): Promise<Driver | null> {
    await delay();
    const index = mockDrivers.findIndex((d) => d.id === id);
    if (index === -1) return null;
    mockDrivers[index] = { ...mockDrivers[index], ...updates };
    return mockDrivers[index];
  },
  async remove(id: string): Promise<Driver | null> {
    await delay();
    const index = mockDrivers.findIndex((d) => d.id === id);
    if (index === -1) return null;
    const [removed] = mockDrivers.splice(index, 1);
    return removed;
  },
  async restore(driver: Driver, position: number): Promise<Driver> {
    await delay();
    mockDrivers.splice(position, 0, driver);
    return driver;
  },
};

export const registrationRequestsApi = {
  async list(): Promise<DriverRegistrationRequest[]> {
    await delay();
    return [...mockPendingRequests];
  },
  async approve(req: DriverRegistrationRequest): Promise<Driver> {
    await delay();
    const idx = mockPendingRequests.findIndex((r) => r.id === req.id);
    if (idx !== -1) mockPendingRequests[idx] = { ...req, status: 'approved' };
    const driver: Driver = {
      id: generateDriverId(),
      name: req.name,
      phone: req.phone,
      email: req.email,
      vehicleModel: '',
      status: 'active',
      trips: 0,
      totalCost: 0,
      charges: 0,
      swaps: 0,
      walletBalance: 0,
      documents: req.documents,
    };
    mockDrivers.unshift(driver);
    return driver;
  },
  async reject(id: string): Promise<void> {
    await delay();
    const idx = mockPendingRequests.findIndex((r) => r.id === id);
    if (idx !== -1) mockPendingRequests[idx] = { ...mockPendingRequests[idx], status: 'rejected' };
  },
};

// ----- Zones ------------------------------------------------------------------

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

function generateZoneId(): string {
  const max = mockZones.reduce((m, z) => {
    const n = parseInt(z.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `ZN${String(max + 1).padStart(3, '0')}`;
}

export const zonesApi = {
  async list(): Promise<Zone[]> {
    await delay();
    return [...mockZones];
  },

  async create(input: ZoneCreateInput): Promise<Zone> {
    await delay();
    const zone: Zone = {
      id: generateZoneId(),
      name: input.name,
      type: input.type,
      speedLimitKmh: input.speedLimitKmh,
      active: input.active,
      visible: true,
      polygon: input.polygon,
      createdAt: new Date().toISOString(),
    };
    mockZones.unshift(zone);
    return zone;
  },

  async update(id: string, updates: ZoneUpdateInput): Promise<Zone | null> {
    await delay();
    const index = mockZones.findIndex((z) => z.id === id);
    if (index === -1) return null;
    mockZones[index] = { ...mockZones[index], ...updates };
    return mockZones[index];
  },

  async remove(id: string): Promise<Zone | null> {
    await delay();
    const index = mockZones.findIndex((z) => z.id === id);
    if (index === -1) return null;
    const [removed] = mockZones.splice(index, 1);
    return removed;
  },

  /** Re-insert a previously deleted zone at a specific position (for Undo). */
  async restore(zone: Zone, position: number): Promise<Zone> {
    await delay();
    mockZones.splice(position, 0, zone);
    return zone;
  },
};

export const dashboardApi = {
  async getMetrics() {
    await delay();
    return mockMetrics;
  },
  async getUsage() {
    await delay();
    return mockUsage;
  },
  async getBatteryHealth() {
    await delay();
    return mockBatteryHealth;
  },
};

export const reportsApi = {
  async getWeeklyTrips() {
    await delay();
    return mockWeeklyTrips;
  },
  async getMonthlyRevenue() {
    await delay();
    return mockMonthlyRevenue;
  },
  async getBatteryDistribution() {
    await delay();
    return mockBatteryDistribution;
  },
  async getCostAnalysis() {
    await delay();
    return mockCostAnalysis;
  },
  async getTopDrivers() {
    await delay();
    return mockTopDrivers;
  },
};

// ----- Battery Swapping -------------------------------------------------------

export const swappingApi = {
  async list(): Promise<SwappingStation[]> {
    await delay();
    return [...mockSwappingStations];
  },
};

// ----- Fast Charging ----------------------------------------------------------

export const fastChargingApi = {
  async list(): Promise<FastChargingCabinet[]> {
    await delay();
    return [...mockFastChargingCabinets];
  },
};

// ----- Wallet (Driver) --------------------------------------------------------

export const walletApi = {
  /** Fetch the current wallet balance for a driver. */
  async getBalance(driverId: string): Promise<number> {
    await delay();
    const driver = mockDrivers.find((d) => d.id === driverId);
    return driver?.walletBalance ?? 0;
  },

  /**
   * Top up a driver's wallet.
   * Replace the body with a real fetch() call when the backend is ready.
   */
  async topUp(
    driverId: string,
    amount: number,
    paymentMethod: string,
    note?: string,
  ): Promise<Driver> {
    await delay();
    void paymentMethod;
    void note;
    const index = mockDrivers.findIndex((d) => d.id === driverId);
    if (index === -1) throw new Error(`Driver ${driverId} not found`);
    mockDrivers[index] = {
      ...mockDrivers[index],
      walletBalance: mockDrivers[index].walletBalance + amount,
    };
    return mockDrivers[index];
  },
};
