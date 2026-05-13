import type { ZoneType } from '@/types';

export interface ZoneTypeConfig {
  type: ZoneType;
  /** i18n key suffix under "zones.types" */
  labelKey: string;
  /** i18n key for the dropdown description in the form */
  descriptionKey: string;
  /** Hex color used for polygon fill, stroke, and indicators */
  color: string;
  /** Tailwind tone for the Badge component */
  badgeTone: 'success' | 'danger' | 'warning' | 'info';
  /** Default speed limit when this type is selected in the form */
  defaultSpeedKmh: number;
  /** Special label for the speed-limit display ("NO RIDING" for no_ride, etc.) */
  speedLabelOverride?: 'no_riding';
}

export const ZONE_TYPES: Record<ZoneType, ZoneTypeConfig> = {
  operational: {
    type: 'operational',
    labelKey: 'operational',
    descriptionKey: 'operationalDescription',
    color: '#10b981', // emerald-500
    badgeTone: 'success',
    defaultSpeedKmh: 45,
  },
  no_ride: {
    type: 'no_ride',
    labelKey: 'noRide',
    descriptionKey: 'noRideDescription',
    color: '#ef4444', // rose-500
    badgeTone: 'danger',
    defaultSpeedKmh: 0,
    speedLabelOverride: 'no_riding',
  },
  slow: {
    type: 'slow',
    labelKey: 'slow',
    descriptionKey: 'slowDescription',
    color: '#f59e0b', // amber-500
    badgeTone: 'warning',
    defaultSpeedKmh: 15,
  },
  parking: {
    type: 'parking',
    labelKey: 'parking',
    descriptionKey: 'parkingDescription',
    color: '#3b82f6', // blue-500
    badgeTone: 'info',
    defaultSpeedKmh: 10,
  },
};

export const ZONE_TYPE_LIST: ZoneTypeConfig[] = [
  ZONE_TYPES.operational,
  ZONE_TYPES.no_ride,
  ZONE_TYPES.slow,
  ZONE_TYPES.parking,
];
