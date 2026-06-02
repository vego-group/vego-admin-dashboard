'use client';

import { Badge } from './Badge';
import { useI18n } from '@/i18n/I18nProvider';
import type { VehicleStatus, DriverStatus, StationStatus } from '@/types';

const vehicleToneMap: Record<VehicleStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  active: 'success',
  charging: 'info',
  idle: 'neutral',
  maintenance: 'warning',
};

const driverToneMap: Record<DriverStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active:   'success',
  inactive: 'neutral',
  pending:  'warning',
  blocked:  'danger',
};

const stationToneMap: Record<StationStatus, 'success' | 'info' | 'warning'> = {
  available: 'success',
  charging: 'info',
  in_use: 'warning',
};

const driverKeyMap: Record<DriverStatus, string> = {
  active:   'active',
  inactive: 'inactive',
  pending:  'pending',
  blocked:  'blocked',
};

interface StatusPillProps {
  status: VehicleStatus | DriverStatus | StationStatus;
  type?: 'vehicle' | 'driver' | 'station';
}

export function StatusPill({ status, type = 'vehicle' }: StatusPillProps) {
  const { t } = useI18n();

  if (type === 'driver') {
    const s = status as DriverStatus;
    return (
      <Badge tone={driverToneMap[s]} dot>
        {t(`status.${driverKeyMap[s]}`)}
      </Badge>
    );
  }

  if (type === 'station') {
    const s = status as StationStatus;
    return <Badge tone={stationToneMap[s]} dot>{s}</Badge>;
  }

  const s = status as VehicleStatus;
  return (
    <Badge tone={vehicleToneMap[s]}>
      {t(`status.${s}`)}
    </Badge>
  );
}
