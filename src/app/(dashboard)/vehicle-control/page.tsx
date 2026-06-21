'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bike } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { VehicleListPanel } from '@/components/vehicle-control/VehicleListPanel';
import { VehicleDetails } from '@/components/vehicle-control/VehicleDetails';
import { ControlPanel } from '@/components/vehicle-control/ControlPanel';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { fleetApi, driversApi } from '@/lib/api';
import type { Vehicle } from '@/types';
import type { Driver } from '@/types';
import type { MotorcycleBattery, MotorcycleStatistics } from '@/lib/api';
import { logger } from '@/lib/logger';

export default function VehicleControlPage() {
  const { t } = useI18n();

  // ── Vehicle list ─────────────────────────────────────────────────────────
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Per-vehicle extra data ────────────────────────────────────────────────
  const [battery, setBattery]         = useState<MotorcycleBattery | null>(null);
  const [statistics, setStatistics]   = useState<MotorcycleStatistics | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // ── Active drivers (for assign dropdown) ─────────────────────────────────
  const [activeDrivers, setActiveDrivers] = useState<Driver[]>([]);

  // ── Initial load: vehicles + active drivers ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [vehicleData, driverData] = await Promise.all([
          fleetApi.list(),
          driversApi.list(),
        ]);
        if (!cancelled) {
          setVehicles(vehicleData);
          setSelectedId(vehicleData[0]?.id ?? null);
          setActiveDrivers(driverData.filter((d) => d.status === 'active'));
        }
      } catch (err) {
        logger.error('[VehicleControl] Failed to load initial data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Fetch battery + statistics whenever selected vehicle changes ──────────
  useEffect(() => {
    if (!selectedId) {
      setBattery(null);
      setStatistics(null);
      return;
    }

    let cancelled = false;
    setLoadingExtra(true);
    setBattery(null);
    setStatistics(null);

    (async () => {
      try {
        const [bat, stats] = await Promise.allSettled([
          fleetApi.getBattery(selectedId),
          fleetApi.getStatistics(selectedId),
        ]);
        if (!cancelled) {
          setBattery(bat.status === 'fulfilled' ? bat.value : null);
          setStatistics(stats.status === 'fulfilled' ? stats.value : null);
        }
      } catch {
        // non-fatal — details panel will fall back to list data
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedId]);

  // ── Driver assignment ─────────────────────────────────────────────────────
  const handleAssignDriver = useCallback(
    async (motorcycleId: string, driverId: string): Promise<boolean> => {
      try {
        const ok = await fleetApi.assignDriver(motorcycleId, driverId);
        if (ok) {
          // API returns boolean — patch state from the local drivers list
          const driver = activeDrivers.find((d) => d.id === driverId);
          setVehicles((prev) =>
            prev.map((v) =>
              v.id === motorcycleId
                ? { ...v, assignedDriverId: driverId, assignedDriverName: driver?.name ?? driverId }
                : v
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        logger.error('[VehicleControl] assignDriver failed:', err);
        return false;
      }
    },
    [activeDrivers]
  );

  const handleUnassignDriver = useCallback(
    async (motorcycleId: string): Promise<boolean> => {
      try {
        const ok = await fleetApi.unassignDriver(motorcycleId);
        if (ok) {
          setVehicles((prev) =>
            prev.map((v) =>
              v.id === motorcycleId
                ? { ...v, assignedDriverId: undefined, assignedDriverName: undefined }
                : v
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        logger.error('[VehicleControl] unassignDriver failed:', err);
        return false;
      }
    },
    []
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardShell title={t('vehicleControl.title')} subtitle={t('vehicleControl.subtitle')}>
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
          <Card className="p-5">
            <Skeleton className="h-[600px] w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-[600px] w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-[600px] w-full" />
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
          {/* Left: Vehicle list */}
          <div className="min-h-[360px] lg:h-[calc(100vh-160px)]">
            <VehicleListPanel
              vehicles={vehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Centre: Vehicle details */}
          <div>
            {selected ? (
              <VehicleDetails
                vehicle={selected}
                battery={battery}
                statistics={statistics}
                loadingExtra={loadingExtra}
              />
            ) : (
              <Card className="flex h-[600px] items-center justify-center">
                <EmptyState
                  icon={<Bike className="h-6 w-6" />}
                  title={t('vehicleControl.selectVehicle')}
                  description={t('vehicleControl.selectVehicleDescription')}
                />
              </Card>
            )}
          </div>

          {/* Right: Control panel */}
          <div>
            {selected && (
              <ControlPanel
                vehicle={selected}
                drivers={activeDrivers}
                onAssignDriver={handleAssignDriver}
                onUnassignDriver={handleUnassignDriver}
              />
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
