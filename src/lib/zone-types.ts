import type { ZoneType } from '@/types';

export interface ZoneTypeConfig {
  type: ZoneType;
  labelKey: string;
  descriptionKey: string;
  color: string;
  badgeTone: 'success' | 'danger' | 'warning' | 'info';
  defaultSpeedKmh: number;
  speedLabelOverride?: 'no_riding';
}

export const ZONE_TYPES: Record<ZoneType, ZoneTypeConfig> = {
  normal: {
    type: 'normal',
    labelKey: 'normal',
    descriptionKey: 'normalDescription',
    color: '#10b981', // emerald-500
    badgeTone: 'success',
    defaultSpeedKmh: 45,
  },
  slow: {
    type: 'slow',
    labelKey: 'slow',
    descriptionKey: 'slowDescription',
    color: '#f59e0b', // amber-500
    badgeTone: 'warning',
    defaultSpeedKmh: 15,
  },
  restricted: {
    type: 'restricted',
    labelKey: 'restricted',
    descriptionKey: 'restrictedDescription',
    color: '#ef4444', // rose-500
    badgeTone: 'danger',
    defaultSpeedKmh: 0,
    speedLabelOverride: 'no_riding',
  },
};

export const ZONE_TYPE_LIST: ZoneTypeConfig[] = [
  ZONE_TYPES.normal,
  ZONE_TYPES.slow,
  ZONE_TYPES.restricted,
];
