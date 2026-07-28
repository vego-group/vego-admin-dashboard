import type { Zone, ZonePoint } from '@/types';

/**
 * Planar geometry helpers for zone polygons.
 *
 * Coordinates are treated as flat (x = lng, y = lat). Zones are city-scale, so
 * the error from ignoring earth curvature is far below the precision a user can
 * draw with by clicking on the map.
 */

const EPS = 1e-12;

/** Cross product of (b - a) x (c - a). Sign tells the turn direction. */
function cross(a: ZonePoint, b: ZonePoint, c: ZonePoint): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function orientation(a: ZonePoint, b: ZonePoint, c: ZonePoint): number {
  const value = cross(a, b, c);
  if (value > EPS) return 1;
  if (value < -EPS) return -1;
  return 0;
}

/** True when `p` lies on segment `a`–`b` (assumes the three are collinear-ish). */
function onSegment(p: ZonePoint, a: ZonePoint, b: ZonePoint): boolean {
  if (orientation(a, b, p) !== 0) return false;
  return (
    p.lng >= Math.min(a.lng, b.lng) - EPS &&
    p.lng <= Math.max(a.lng, b.lng) + EPS &&
    p.lat >= Math.min(a.lat, b.lat) - EPS &&
    p.lat <= Math.max(a.lat, b.lat) + EPS
  );
}

/** True when segments `a1`–`a2` and `b1`–`b2` cross or touch. */
export function segmentsIntersect(
  a1: ZonePoint,
  a2: ZonePoint,
  b1: ZonePoint,
  b2: ZonePoint,
): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;

  // Collinear touching cases
  if (o1 === 0 && onSegment(b1, a1, a2)) return true;
  if (o2 === 0 && onSegment(b2, a1, a2)) return true;
  if (o3 === 0 && onSegment(a1, b1, b2)) return true;
  if (o4 === 0 && onSegment(a2, b1, b2)) return true;

  return false;
}

/** Ray-casting containment test. A point sitting on an edge counts as inside. */
export function pointInPolygon(point: ZonePoint, polygon: ZonePoint[]): boolean {
  if (polygon.length < 3) return false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (onSegment(point, polygon[j], polygon[i])) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { lat: yi, lng: xi } = polygon[i];
    const { lat: yj, lng: xj } = polygon[j];
    const crossesRay =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

/** True when the segment `from`–`to` crosses any edge of `polygon`. */
export function segmentCrossesPolygon(
  from: ZonePoint,
  to: ZonePoint,
  polygon: ZonePoint[],
): boolean {
  if (polygon.length < 3) return false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentsIntersect(from, to, polygon[j], polygon[i])) return true;
  }
  return false;
}

/**
 * True when two polygons share any area — crossing edges, touching edges, or
 * one being fully contained in the other.
 */
export function polygonsOverlap(a: ZonePoint[], b: ZonePoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;

  // Crossing / touching boundaries
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    if (segmentCrossesPolygon(a[j], a[i], b)) return true;
  }

  // Full containment either way (no boundary ever crosses in that case)
  if (pointInPolygon(a[0], b)) return true;
  if (pointInPolygon(b[0], a)) return true;

  return false;
}

/** Every existing zone whose polygon overlaps `polygon`. */
export function findOverlappingZones(
  polygon: ZonePoint[],
  zones: Zone[],
  excludeZoneId?: string,
): Zone[] {
  if (polygon.length < 3) return [];
  return zones.filter(
    (zone) =>
      zone.id !== excludeZoneId &&
      zone.polygon.length >= 3 &&
      polygonsOverlap(polygon, zone.polygon),
  );
}

/** The first zone that contains `point`, if any. */
export function findZoneAtPoint(
  point: ZonePoint,
  zones: Zone[],
  excludeZoneId?: string,
): Zone | null {
  return (
    zones.find(
      (zone) =>
        zone.id !== excludeZoneId &&
        zone.polygon.length >= 3 &&
        pointInPolygon(point, zone.polygon),
    ) ?? null
  );
}

/** The first zone whose boundary is cut by the segment `from`–`to`, if any. */
export function findZoneCrossedByEdge(
  from: ZonePoint,
  to: ZonePoint,
  zones: Zone[],
  excludeZoneId?: string,
): Zone | null {
  return (
    zones.find(
      (zone) =>
        zone.id !== excludeZoneId &&
        zone.polygon.length >= 3 &&
        segmentCrossesPolygon(from, to, zone.polygon),
    ) ?? null
  );
}
