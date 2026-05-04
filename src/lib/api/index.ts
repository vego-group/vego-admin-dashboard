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
  mockMetrics,
  mockMonthlyRevenue,
  mockStations,
  mockTopDrivers,
  mockUsage,
  mockVehicles,
  mockWeeklyTrips,
} from '@/lib/mock-data';
import type { BatteryStation, Driver, Vehicle } from '@/types';

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

export const driversApi = {
  async list(): Promise<Driver[]> {
    await delay();
    return mockDrivers;
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
