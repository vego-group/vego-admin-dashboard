'use client';

import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { VehicleListPanel } from '@/components/vehicle-control/VehicleListPanel';
import { VehicleDetails } from '@/components/vehicle-control/VehicleDetails';
import { ControlPanel } from '@/components/vehicle-control/ControlPanel';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n/I18nProvider';
import { fleetApi } from '@/lib/api';
import type { Vehicle } from '@/types';

export default function VehicleControlPage() {
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fleetApi.list();
      if (!cancelled) {
        setVehicles(data);
        setSelectedId(data[0]?.id ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  const handleUpdate = async (updates: Partial<Vehicle>) => {
    if (!selected) return;
    const updated = await fleetApi.update(selected.id, updates);
    if (updated) {
      setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    }
  };

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
          <div className="min-h-[360px] lg:h-[calc(100vh-160px)]">
            <VehicleListPanel
              vehicles={vehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div>
            {selected ? (
              <VehicleDetails vehicle={selected} />
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

          <div>
            {selected && <ControlPanel vehicle={selected} onUpdate={handleUpdate} />}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
