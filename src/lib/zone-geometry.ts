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

// ── The shape's own outline (FA-325) ─────────────────────────────────────────
//
// A zone's outline must not cross or touch itself: a "bow-tie" is not a valid
// polygon (PostGIS ST_IsValid refuses it) and has no sensible inside. Edges
// that follow each other meet at their shared vertex by construction — that is
// not a crossing, even when the path carries straight on through it. Two such
// edges are only wrong when the second doubles back over the first. Any other
// pair of edges may not meet at all.

function samePoint(a: ZonePoint, b: ZonePoint): boolean {
  return Math.abs(a.lat - b.lat) <= EPS && Math.abs(a.lng - b.lng) <= EPS;
}

/** The points with consecutive repeats (a double click on one spot) removed. */
function withoutRepeats(points: ZonePoint[]): ZonePoint[] {
  const out: ZonePoint[] = [];
  for (const p of points) {
    if (out.length === 0 || !samePoint(out[out.length - 1], p)) out.push(p);
  }
  return out;
}

/**
 * Edges `shared`–`a` and `shared`–`b` follow each other through `shared`. True
 * when they run back over each other: collinear, and leaving `shared` the same
 * way. Collinear and leaving it in opposite directions is a straight line.
 */
function adjacentEdgesOverlap(shared: ZonePoint, a: ZonePoint, b: ZonePoint): boolean {
  if (orientation(shared, a, b) !== 0) return false;
  const dot = (a.lng - shared.lng) * (b.lng - shared.lng) + (a.lat - shared.lat) * (b.lat - shared.lat);
  return dot > 0;
}

/**
 * Would the edge from the last point of the open path being drawn to `next`
 * cross or touch the path's own earlier edges? The edge back to the first
 * point does not exist yet; {@link closingEdgeCrossesPath} checks it when the
 * shape is finished. A click on the last point again adds no edge: false.
 */
export function newEdgeCrossesPath(path: ZonePoint[], next: ZonePoint): boolean {
  const pts = withoutRepeats(path);
  const n = pts.length;
  if (n === 0) return false;
  const last = pts[n - 1];
  if (samePoint(last, next)) return false;
  // The edge just before meets the new one at `last`, and may only meet it there.
  if (n >= 2 && adjacentEdgesOverlap(last, pts[n - 2], next)) return true;
  // Every earlier edge, pts[i]–pts[i+1] for i = 0 … n-3: no contact at all.
  for (let i = 0; i + 1 < n - 1; i++) {
    if (segmentsIntersect(pts[i], pts[i + 1], last, next)) return true;
  }
  return false;
}

/**
 * Would closing the path — the edge from its last point back to its first —
 * cross or touch the path's own edges? False for fewer than 3 distinct points,
 * which are not a shape yet.
 */
export function closingEdgeCrossesPath(path: ZonePoint[]): boolean {
  const pts = withoutRepeats(path);
  const n = pts.length;
  if (n < 3) return false;
  const first = pts[0];
  const last = pts[n - 1];
  // It meets the last edge at `last` and the first edge at `first`, only there.
  if (adjacentEdgesOverlap(last, pts[n - 2], first)) return true;
  if (adjacentEdgesOverlap(first, pts[1], last)) return true;
  // Every other edge, pts[i]–pts[i+1] for i = 1 … n-3: no contact at all.
  for (let i = 1; i + 1 < n - 1; i++) {
    if (segmentsIntersect(pts[i], pts[i + 1], last, first)) return true;
  }
  return false;
}

/** True when the closed outline through `points` crosses or touches itself. */
export function outlineCrossesItself(points: ZonePoint[]): boolean {
  const pts = withoutRepeats(points);
  for (let k = 1; k < pts.length; k++) {
    if (newEdgeCrossesPath(pts.slice(0, k), pts[k])) return true;
  }
  return closingEdgeCrossesPath(pts);
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
