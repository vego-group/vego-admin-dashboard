import type { Zone, ZoneType } from '@/types';

export interface ZoneTypeConfig {
  type: ZoneType;
  labelKey: string;
  descriptionKey: string;
  color: string;
  badgeTone: 'success' | 'danger' | 'warning' | 'info';
  /** Speed limit a new zone of this type starts with; `null` = the type takes none. */
  defaultSpeedKmh: number | null;
  speedLabelOverride?: 'no_riding';
}

export const ZONE_TYPES: Record<ZoneType, ZoneTypeConfig> = {
  normal: {
    type: 'normal',
    labelKey: 'normal',
    descriptionKey: 'normalDescription',
    color: '#10b981', // emerald-500
    badgeTone: 'success',
    defaultSpeedKmh: null,
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
    defaultSpeedKmh: null,
    speedLabelOverride: 'no_riding',
  },
};

export const ZONE_TYPE_LIST: ZoneTypeConfig[] = [
  ZONE_TYPES.normal,
  ZONE_TYPES.slow,
  ZONE_TYPES.restricted,
];

/**
 * The range the zone API accepts for `speed_limit`; anything else is `null`
 * ("no limit"). `0` is never valid — create and update reject it (backend reply
 * 2026-10-20).
 */
export const ZONE_SPEED_LIMIT_MIN = 1;
export const ZONE_SPEED_LIMIT_MAX = 200;

/** A whole number of km/h the zone API accepts? */
export function isValidZoneSpeedLimit(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= ZONE_SPEED_LIMIT_MIN && value <= ZONE_SPEED_LIMIT_MAX;
}

/**
 * The `speed_limit` to send for a zone of `type`: the limit for a `slow` zone,
 * `null` for every other type, and never `0`. A speed limit only applies to slow
 * zones; the backend ignores the number on any other type.
 */
export function zoneSpeedLimitPayload(type: ZoneType | undefined, kmh: number | null | undefined): number | null {
  if (type !== undefined && type !== 'slow') return null;
  return isValidZoneSpeedLimit(kmh) ? kmh : null;
}

/**
 * The speed-limit row for a zone: "20 km/h" for a slow zone with a limit,
 * "No riding" for a restricted zone, and "No limit" for everything else — a
 * normal zone, or a slow zone the backend sent without a limit.
 */
export function zoneSpeedLimitText(zone: Pick<Zone, 'type' | 'speedLimitKmh'>, t: (key: string) => string): string {
  if (ZONE_TYPES[zone.type].speedLabelOverride === 'no_riding') return t('zones.noRiding');
  return zone.type === 'slow' && zone.speedLimitKmh != null
    ? `${zone.speedLimitKmh} ${t('common.kmh')}`
    : t('zones.noLimit');
}
